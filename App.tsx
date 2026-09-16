
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  DollarSign, 
  CheckSquare, 
  Image as ImageIcon, // Icon changed for Mascota
  Menu,
  X,
  Bell,
  LogOut,
  Settings,
  ChevronUp,
  Building2, // Added icon for Company Name
  Key, // Added icon for API Key
  CheckCircle,
  AlertCircle,
  Loader2,
  Tag,
  Activity,
  Download, // Icon for install
  Smartphone,
  Upload, // Added Upload icon
  FileSignature, // Added FileSignature for Promissory Notes
  FileWarning, // Added FileWarning for Fallos
  LayoutGrid,
  Sparkles,
  RefreshCw,
  Database,
  Trash2,
  FileDown,
  FileUp,
  Cloud,
  ExternalLink,
  Wand2,
  Printer,
  Car,
  MessageSquare,
  FileStack
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  Employee, 
  Expense, 
  Task, 
  Fallo, 
  Plaza, 
  Vehicle, 
  VehicleAssignment, 
  VehicleEvent 
} from './types';

import { Dashboard } from './components/Dashboard';
import { Personnel } from './components/Personnel';
import { Expenses } from './components/Expenses';
import { Tasks } from './components/Tasks';
import { PromissoryNotes } from './components/PromissoryNotes'; // Import new component
import { Mascota } from './components/Mascota'; 
import { Login } from './components/Login';
import { Assistant } from './components/Assistant'; 
import { Fallos } from './components/Fallos';
import { Imprenta } from './components/Imprenta';
import { Vehicles } from './components/Vehicles';
import { SettingsSection } from './components/SettingsSection';
import { Formatos } from './components/Formatos';

import { 
  getEmployees, 
  getExpenses, 
  getExpensesByDateRange, 
  getTasks, 
  getAppSettings, 
  updateAppSettings, 
  getFallos,
  subscribeToEmployees,
  subscribeToTasks,
  subscribeToAppSettings,
  subscribeToDashboardExpenses,
  subscribeToAllExpenses,
  subscribeToAllFallos,
  subscribeToPlazas,
  getBase64Fallos,
  deleteBase64Fallos,
  importFallos,
  subscribeToVehicles,
  subscribeToVehicleAssignments,
  subscribeToVehicleEvents
} from './services/dbService';
import { validateApiKey } from './services/geminiService';
import { hasConfig } from './firebase';
import { NewInstallation } from './components/NewInstallation';
import { PublicCredentialView } from './components/PublicCredentialView';

function App() {
  // Auth State - Initialize from LocalStorage to persist session
  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    try {
      const savedUser = localStorage.getItem('office_user_session');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      console.error("Error parsing session", e);
      return null;
    }
  });

  // App State
  const [activeTab, setActiveTab] = useState('tablero');
  const [selectedBdayEmployeeId, setSelectedBdayEmployeeId] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Sync activeTab with URL
  useEffect(() => {
    if (currentUser?.isOfficeUser) {
      setActiveTab('gastos');
      if (location.pathname !== '/gastos') {
        navigate('/gastos');
      }
      return;
    }
    const path = location.pathname.substring(1);
    if (path && navItems.some(item => item.id === path)) {
      setActiveTab(path);
    } else if (location.pathname === '/') {
      setActiveTab('tablero');
    }
  }, [location.pathname, currentUser]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'tablero') {
      navigate('/');
    } else {
      navigate(`/${tabId}`);
    }
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Connection Status State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Public Credential Route State (when QR is scanned)
  const [publicCredentialId, setPublicCredentialId] = useState<string | null>(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const credParam = searchParams.get('credencial');
      if (credParam) return credParam;

      const path = window.location.pathname;
      if (path.startsWith('/credencial/')) {
        return path.replace('/credencial/', '');
      }
      const hash = window.location.hash;
      if (hash.includes('credencial/')) {
        const parts = hash.split('credencial/');
        return parts[1] ? parts[1].split('?')[0] : null;
      }
    } catch {
      // Fallback
    }
    return null;
  });

  // Settings State
  const [mascotaUrl, setMascotaUrl] = useState('');
  const [mascotaName, setMascotaName] = useState('Mascota');
  const [companyName, setCompanyName] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [companyRfc, setCompanyRfc] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [showCompanyInfoOnCredential, setShowCompanyInfoOnCredential] = useState(false);
  const [imprentaUrl, setImprentaUrl] = useState('');
  const [multiOfficeEnabled, setMultiOfficeEnabled] = useState(false);
  
  const navItems = useMemo(() => {
    const items = [
      { id: 'tablero', label: 'Panel', icon: LayoutDashboard },
      { id: 'personal', label: 'Personal', icon: Users },
      { id: 'autos', label: 'Auto', icon: Car },
      { id: 'gastos', label: 'Gastos', icon: DollarSign },
      { id: 'tareas', label: 'Tareas', icon: CheckSquare },
      { id: 'pagares', label: 'Pagarés', icon: FileSignature },
      { id: 'formatos', label: 'Formatos', icon: FileStack },
      { id: 'fallos', label: 'Fallos', icon: FileWarning },
      { id: 'mascota', label: `Mi ${mascotaName}`, icon: ImageIcon }, 
      { id: 'imprenta', label: 'Imprenta', icon: Printer },
      { id: 'ajustes', label: 'Ajustes', icon: Settings },
    ];
    if (currentUser?.isOfficeUser) {
      return items.filter(item => item.id === 'gastos');
    }
    return items;
  }, [mascotaName, currentUser?.isOfficeUser]);
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [imgbbApiKey, setImgbbApiKey] = useState('');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [appStatusColor, setAppStatusColor] = useState('#10B981'); 
  const [mobileNavSections, setMobileNavSections] = useState<string[]>(['tablero', 'personal', 'autos', 'gastos', 'tareas', 'fallos', 'imprenta']);
  const [birthdayPrompt, setBirthdayPrompt] = useState<string>('');
  const [birthdayVideoPrompt, setBirthdayVideoPrompt] = useState<string>('');
  const [birthdayWhatsAppTemplate, setBirthdayWhatsAppTemplate] = useState<string>('');
  const [loadAllExpenses, setLoadAllExpenses] = useState(false);
  const [loadAllFallos, setLoadAllFallos] = useState(false);
  const [isSyncingExpenses, setIsSyncingExpenses] = useState(false);
  const [isSyncingFallos, setIsSyncingFallos] = useState(false);
  
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // User Menu State
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Global Data State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dashboardExpenses, setDashboardExpenses] = useState<Expense[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fallos, setFallos] = useState<Fallo[]>([]);
  const [plazas, setPlazas] = useState<Plaza[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleAssignments, setVehicleAssignments] = useState<VehicleAssignment[]>([]);
  const [vehicleEvents, setVehicleEvents] = useState<VehicleEvent[]>([]);
  
  // Loading flags for lazy loading
  const [hasLoadedEmployees, setHasLoadedEmployees] = useState(false);
  const [hasLoadedExpenses, setHasLoadedExpenses] = useState(false);
  const [hasLoadedDashboard, setHasLoadedDashboard] = useState(false);
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [hasLoadedFallos, setHasLoadedFallos] = useState(false);
  const [hasLoadedVehicles, setHasLoadedVehicles] = useState(false);

  const [connectionError, setConnectionError] = useState<string | null>(null);

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errMessage = error?.message || String(error);
    const errInfo = {
      error: errMessage,
      operationType: operation,
      path: path,
      authInfo: {
        userId: currentUser?.id,
        email: currentUser?.email,
      }
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    
    // Capture loading phase errors to prevent app hanging
    if (operation === 'LIST' || operation === 'GET') {
      setConnectionError(`Error cargando (${path}): ${errMessage}`);
    }
  };

  // PWA: Listen for install prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // PWA & UI: Dynamic Manifest and Favicon Update
  useEffect(() => {
    const updateAppIdentity = () => {
        const dynamicName = companyName ? `Mi Oficina ${companyName}` : "Mi Oficina";
        
        // 1. Update Document Title
        document.title = dynamicName;

        // 2. Update Favicon (Tab Icon)
        const favicon = document.getElementById('app-favicon') as HTMLLinkElement;
        if (favicon && mascotaUrl) {
            favicon.href = mascotaUrl;
        }

        // 3. Update Manifest (PWA Icon & Name)
        // Only update if we have specific settings to avoid overriding default with empty values initially
        if (companyName || mascotaUrl) {
            const manifest = {
                name: dynamicName,
                short_name: companyName || "Mi Oficina",
                start_url: "/",
                display: "standalone",
                background_color: "#ffffff",
                theme_color: appStatusColor || "#4f46e5",
                icons: [
                    {
                        src: mascotaUrl || "/vite.svg",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "any maskable" 
                    },
                    {
                        src: mascotaUrl || "/vite.svg",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any maskable"
                    }
                ]
            };

            const stringManifest = JSON.stringify(manifest);
            const blob = new Blob([stringManifest], {type: 'application/json'});
            const manifestURL = URL.createObjectURL(blob);
            
            const link = document.querySelector('#app-manifest');
            if (link) {
                link.setAttribute('href', manifestURL);
            }
        }
    };
    
    updateAppIdentity();
  }, [companyName, mascotaUrl, appStatusColor]);

  // Click outside listener for user menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Network Status Listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load Initial Settings
  useEffect(() => {
    const initSettings = async () => {
      try {
        const settingsData = await getAppSettings();
        setCompanyName(settingsData.companyName || '');
        setCompanyLogoUrl(settingsData.companyLogoUrl || '');
        setCompanyRfc(settingsData.companyRfc || '');
        setCompanyAddress(settingsData.companyAddress || '');
        setCompanyPhone(settingsData.companyPhone || '');
        setShowCompanyInfoOnCredential(!!settingsData.showCompanyInfoOnCredential);
        setMascotaName(settingsData.mascotaName || 'Mascota');
        setMascotaUrl(settingsData.mascotaUrl || '');
        setGoogleApiKey(settingsData.googleApiKey || '');
        setImgbbApiKey(settingsData.imgbbApiKey || '');
        setAppVersion(settingsData.appVersion || '1.0.0');
        setAppStatusColor(settingsData.appStatusColor || '#10B981');
        setImprentaUrl(settingsData.imprentaUrl || '');
        setBirthdayWhatsAppTemplate(settingsData.birthdayWhatsAppTemplate || '');
        setMultiOfficeEnabled(!!settingsData.multiOfficeEnabled);
      } catch (e) {
        console.error("Error fetching settings on init:", e);
      }
    };
    initSettings();
  }, []);

  const fetchEmployees = async () => {
    if (hasLoadedEmployees) return;
    setLoading(true);
    try {
      const data = await getEmployees();
      setEmployees(data);
      setHasLoadedEmployees(true);
    } catch (e) {
      console.error("Error fetching employees", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    if (hasLoadedExpenses) return;
    setLoading(true);
    try {
      const data = await getExpenses();
      setExpenses(data);
      setHasLoadedExpenses(true);
    } catch (e) {
      console.error("Error fetching expenses", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    if (hasLoadedTasks) return;
    setLoading(true);
    try {
      const data = await getTasks();
      setTasks(data);
      setHasLoadedTasks(true);
    } catch (e) {
      console.error("Error fetching tasks", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchFallos = async () => {
    if (hasLoadedFallos) return;
    setLoading(true);
    try {
      const data = await getFallos();
      setFallos(data);
      setHasLoadedFallos(true);
    } catch (e) {
      console.error("Error fetching fallos", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardExpenses = async () => {
    if (hasLoadedDashboard) return;
    setLoading(true);
    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const data = await getExpensesByDateRange(firstDay, lastDay);
      setDashboardExpenses(data);
      setHasLoadedDashboard(true);
    } catch (e) {
      console.error("Error fetching dashboard expenses", e);
    } finally {
      setLoading(false);
    }
  };

  // Global data subscriptions (once per login)
  useEffect(() => {
    if (!currentUser || !hasConfig) return;

    const unsubscribers: (() => void)[] = [];
    const handleError = (error: any, op: string, path: string) => {
      handleFirestoreError(error, op, path);
    };

    // Settings
    unsubscribers.push(subscribeToAppSettings((settings) => {
      setCompanyName(settings.companyName);
      setCompanyLogoUrl(settings.companyLogoUrl || '');
      setCompanyRfc(settings.companyRfc || '');
      setCompanyAddress(settings.companyAddress || '');
      setCompanyPhone(settings.companyPhone || '');
      setShowCompanyInfoOnCredential(!!settings.showCompanyInfoOnCredential);
      setMascotaName(settings.mascotaName);
      setMascotaUrl(settings.mascotaUrl);
      setGoogleApiKey(settings.googleApiKey);
      if (settings.imgbbApiKey !== undefined) {
        setImgbbApiKey(settings.imgbbApiKey);
      }
      setAppVersion(settings.appVersion);
      setAppStatusColor(settings.appStatusColor);
      if (settings.mobileNavSections) {
        // Migrate old IDs if necessary
        const idMap: Record<string, string> = {
          'dashboard': 'tablero',
          'personnel': 'personal',
          'expenses': 'gastos',
          'tasks': 'tareas',
          'promissory': 'pagares'
        };
        const migrated = settings.mobileNavSections.map((id: string) => idMap[id] || id);
        setMobileNavSections(migrated);
      }
      if (settings.birthdayPrompt) {
        setBirthdayPrompt(settings.birthdayPrompt);
      }
      if (settings.birthdayVideoPrompt) {
        setBirthdayVideoPrompt(settings.birthdayVideoPrompt);
      }
      if (settings.birthdayWhatsAppTemplate !== undefined) {
        setBirthdayWhatsAppTemplate(settings.birthdayWhatsAppTemplate);
      }
      if (settings.imprentaUrl !== undefined) {
        setImprentaUrl(settings.imprentaUrl);
      }
      if (settings.multiOfficeEnabled !== undefined) {
        setMultiOfficeEnabled(settings.multiOfficeEnabled);
      }
    }, (err) => handleError(err, 'GET', 'settings/global_config')));

    // Employees
    unsubscribers.push(subscribeToEmployees((data) => {
      setEmployees(data);
      setHasLoadedEmployees(true);
    }, (err) => handleError(err, 'LIST', 'employees')));
    
    // Plazas
    unsubscribers.push(subscribeToPlazas(setPlazas, (err) => handleError(err, 'LIST', 'plazas')));
    
    // Tasks
    unsubscribers.push(subscribeToTasks((data) => {
      setTasks(data);
      setHasLoadedTasks(true);
    }, (err) => handleError(err, 'LIST', 'tasks')));

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [currentUser?.id]);

  // Background loading for Expenses and Fallos (with limit or full)
  useEffect(() => {
    if (!currentUser || !hasConfig) return;
    
    const unsubscribers: (() => void)[] = [];
    const handleError = (error: any, op: string, path: string) => {
      handleFirestoreError(error, op, path);
    };

    // If we are loading ALL, we don't want the 1.5s delay if we're already in the tab
    // but for the initial background load, a small delay is good for dashboard performance
    const delay = (loadAllExpenses || loadAllFallos) ? 0 : 1500;

    const backgroundTimeout = setTimeout(() => {
      // All Expenses
      unsubscribers.push(subscribeToAllExpenses((data) => {
        setExpenses(data);
        setHasLoadedExpenses(true);
        setIsSyncingExpenses(false);
      }, (err) => {
        handleError(err, 'LIST', 'expenses');
        setIsSyncingExpenses(false);
      }, 0));
      
      // All Fallos - Load last 3 months by default
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const dateString = threeMonthsAgo.toISOString().split('T')[0];

      unsubscribers.push(subscribeToAllFallos((data) => {
        setFallos(data);
        setHasLoadedFallos(true);
        setIsSyncingFallos(false);
      }, (err) => {
        handleError(err, 'LIST', 'fallos');
        setIsSyncingFallos(false);
      }, loadAllFallos ? 0 : 0, loadAllFallos ? undefined : dateString));
    }, delay);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      clearTimeout(backgroundTimeout);
    };
  }, [currentUser?.id, loadAllExpenses, loadAllFallos]);

  // Tab-specific data subscriptions
  useEffect(() => {
    if (!currentUser || !hasConfig) return;

    const unsubscribers: (() => void)[] = [];
    const handleError = (error: any, op: string, path: string) => {
      handleFirestoreError(error, op, path);
    };

    if (activeTab === 'tablero') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      unsubscribers.push(subscribeToDashboardExpenses(firstDay, lastDay, (data) => {
        setDashboardExpenses(data);
        setHasLoadedDashboard(true);
      }, (err) => handleError(err, 'LIST', 'expenses')));
    }
    
    if (activeTab === 'autos') {
      unsubscribers.push(subscribeToVehicles((data) => {
        setVehicles(data);
        setHasLoadedVehicles(true);
      }, (err) => handleError(err, 'LIST', 'vehicles')));

      unsubscribers.push(subscribeToVehicleAssignments((data) => {
        setVehicleAssignments(data);
      }, (err) => handleError(err, 'LIST', 'vehicle_assignments')));

      unsubscribers.push(subscribeToVehicleEvents((data) => {
        setVehicleEvents(data);
      }, (err) => handleError(err, 'LIST', 'vehicle_events')));
    }
    // Note: All Expenses and All Fallos are now handled by the dedicated background useEffect
    // which also handles the "Load All" toggle.

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [activeTab, currentUser?.id]);

  const handleLogin = (user: Employee) => {
    localStorage.setItem('office_user_session', JSON.stringify(user));
    setCurrentUser(user);
    // Data will be loaded by the useEffect above
  };

  const handleLogout = () => {
    localStorage.removeItem('office_user_session');
    setCurrentUser(null);
    setEmployees([]);
    setExpenses([]);
    setTasks([]);
    setFallos([]);
    setHasLoadedEmployees(false);
    setHasLoadedExpenses(false);
    setHasLoadedTasks(false);
    setHasLoadedFallos(false);
    setActiveTab('dashboard');
    setUserMenuOpen(false);
  };

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setUserMenuOpen(false);
  };

  const handleOpenSettings = () => {
    handleTabChange('ajustes');
    setUserMenuOpen(false);
  };

  if (!hasConfig || location.pathname === '/instalacionnueva') {
    return (
      <NewInstallation 
        showCancelButton={hasConfig}
        onCancel={() => navigate('/')}
      />
    );
  }

  if (publicCredentialId) {
    return (
      <PublicCredentialView 
        employeeId={publicCredentialId}
        onGoToApp={() => {
          window.history.replaceState({}, '', window.location.pathname);
          setPublicCredentialId(null);
        }}
      />
    );
  }

  if (!currentUser) {
    return <Login 
      onLogin={handleLogin} 
      appVersion={appVersion}
      appStatusColor={appStatusColor}
      isOnline={isOnline}
    />;
  }

  const renderContent = () => {
    // Check if data for the current tab is ready
    const isDashboardReady = hasLoadedEmployees && hasLoadedTasks && hasLoadedDashboard;
    const isPersonnelReady = hasLoadedEmployees;
    const isExpensesReady = hasLoadedExpenses;
    const isTasksReady = hasLoadedTasks && hasLoadedEmployees;
    const isFallosReady = hasLoadedFallos && hasLoadedEmployees;

    let isTabReady = true;
    if (activeTab === 'tablero') isTabReady = isDashboardReady;
    else if (activeTab === 'personal') isTabReady = isPersonnelReady;
    else if (activeTab === 'tareas') isTabReady = isTasksReady;
    else if (activeTab === 'autos') isTabReady = hasLoadedVehicles && hasLoadedEmployees;
    // Gastos and Fallos handle their own loading state internally via props
    // so we don't block the whole app while they sync heavy image data

    if (loading || !isTabReady) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-gray-50/30 p-6 text-center">
          {connectionError ? (
            <div className="max-w-md bg-white border border-red-100 rounded-2xl shadow-xl p-6 flex flex-col items-center animate-fade-in">
              <div className="p-3 bg-red-50 text-red-500 rounded-full mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Error de Conexión</h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                {connectionError}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={() => {
                    setConnectionError(null);
                    window.location.reload();
                  }}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4 animate-spin-reverse" /> Reintentar
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('firebase_config');
                    window.location.reload();
                  }}
                  className="flex-1 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
                >
                  Reconfigurar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-600"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-8 h-8 bg-indigo-100 rounded-full animate-pulse"></div>
                </div>
              </div>
              <p className="mt-4 text-gray-500 font-medium animate-pulse">Cargando datos de la oficina...</p>
              {!isOnline && (
                <div className="mt-2 flex items-center text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 text-xs font-bold animate-bounce">
                  <AlertCircle className="w-3 h-3 mr-1" /> Sin conexión a Internet
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-2">Sincronizando con la base de datos en tiempo real</p>
              <p className="text-[10px] text-gray-400 mt-4 opacity-50 italic">Si no carga, es culpa de Vick</p>
            </>
          )}
        </div>
      );
    }

    switch (activeTab) {
      case 'tablero': return <Dashboard currentUser={currentUser} employees={employees} expenses={dashboardExpenses} tasks={tasks} mascotaUrl={mascotaUrl} mascotaName={mascotaName} companyName={companyName} birthdayPrompt={birthdayPrompt} birthdayVideoPrompt={birthdayVideoPrompt} birthdayWhatsAppTemplate={birthdayWhatsAppTemplate} selectedBdayEmployeeId={selectedBdayEmployeeId} setSelectedBdayEmployeeId={setSelectedBdayEmployeeId} />;
      case 'personal': return <Personnel employees={employees} plazas={plazas} isLoading={!hasLoadedEmployees} currentUser={currentUser} companyName={companyName} companyLogoUrl={companyLogoUrl} companyRfc={companyRfc} companyAddress={companyAddress} companyPhone={companyPhone} showCompanyInfoOnCredential={showCompanyInfoOnCredential} />;
      case 'autos': return <Vehicles employees={employees} vehicles={vehicles} assignments={vehicleAssignments} events={vehicleEvents} isLoading={!hasLoadedVehicles} companyName={companyName} />;
      case 'gastos': return <Expenses expenses={expenses} employees={employees} isLoading={!hasLoadedExpenses} loadAll={loadAllExpenses} isSyncing={isSyncingExpenses} onLoadAll={() => { setLoadAllExpenses(true); setIsSyncingExpenses(true); }} multiOfficeEnabled={multiOfficeEnabled} currentUser={currentUser} />;
      case 'tareas': return <Tasks tasks={tasks} employees={employees} isLoading={!hasLoadedTasks} />;
      case 'pagares': return <PromissoryNotes companyName={companyName} />;
      case 'formatos': return <Formatos companyName={companyName} companyLogoUrl={companyLogoUrl} companyRfc={companyRfc} companyAddress={companyAddress} companyPhone={companyPhone} employees={employees} plazas={plazas} currentUser={currentUser} />;
      case 'fallos': return <Fallos currentUser={currentUser} employees={employees} fallos={fallos} isLoading={!hasLoadedFallos} loadAll={loadAllFallos} isSyncing={isSyncingFallos} onLoadAll={() => { setLoadAllFallos(true); setIsSyncingFallos(true); }} />;
      case 'mascota': return <Mascota mascotaUrl={mascotaUrl} mascotaName={mascotaName} onOpenSettings={handleOpenSettings} employees={employees} onSelectBdayEmployee={(empId) => { setSelectedBdayEmployeeId(empId); handleTabChange('tablero'); }} />;
      case 'imprenta': return <Imprenta imprentaUrl={imprentaUrl} onOpenSettings={handleOpenSettings} />;
      case 'ajustes':
        return (
          <SettingsSection
            companyName={companyName}
            companyLogoUrl={companyLogoUrl}
            companyRfc={companyRfc}
            companyAddress={companyAddress}
            companyPhone={companyPhone}
            showCompanyInfoOnCredential={showCompanyInfoOnCredential}
            mascotaName={mascotaName}
            mascotaUrl={mascotaUrl}
            imprentaUrl={imprentaUrl}
            googleApiKey={googleApiKey}
            imgbbApiKey={imgbbApiKey}
            appVersion={appVersion}
            appStatusColor={appStatusColor}
            mobileNavSections={mobileNavSections}
            birthdayPrompt={birthdayPrompt}
            birthdayVideoPrompt={birthdayVideoPrompt}
            birthdayWhatsAppTemplate={birthdayWhatsAppTemplate}
            multiOfficeEnabled={multiOfficeEnabled}
            onClose={() => handleTabChange('tablero')}
          />
        );
      default: return <Dashboard currentUser={currentUser} employees={employees} expenses={dashboardExpenses} tasks={tasks} mascotaUrl={mascotaUrl} mascotaName={mascotaName} companyName={companyName} birthdayPrompt={birthdayPrompt} birthdayVideoPrompt={birthdayVideoPrompt} birthdayWhatsAppTemplate={birthdayWhatsAppTemplate} selectedBdayEmployeeId={selectedBdayEmployeeId} setSelectedBdayEmployeeId={setSelectedBdayEmployeeId} />;
    }
  };

  // Dynamic Tab Labels for Header Breadcrumb
  const currentTabLabel = useMemo(() => {
    const item = navItems.find(i => i.id === activeTab);
    return item ? item.label : 'Panel';
  }, [activeTab, navItems]);

  return (
    <div className="flex h-screen h-[100dvh] bg-slate-50 text-slate-900 overflow-hidden relative">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Enterprise Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col justify-between
        transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0 shadow-2xl lg:shadow-none' : '-translate-x-full'}
      `}>
        {/* Brand Header */}
        <div>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm shrink-0 font-bold text-sm">
                {companyName ? companyName.charAt(0).toUpperCase() : 'O'}
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none truncate">
                  Mi Oficina
                </h1>
                <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                  {companyName || 'Empresarial'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)} 
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Navigation Links */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Módulos Principales
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    handleTabChange(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                    isActive 
                      ? 'bg-slate-900 text-white shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 mr-3 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50" ref={userMenuRef}>
          {userMenuOpen && (
             <div className="absolute bottom-20 left-3 right-3 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fade-in z-50 py-1">
                {/* Install App Button */}
                {deferredPrompt && (
                  <>
                    <button 
                      onClick={handleInstallApp}
                      className="w-full text-left px-4 py-2.5 text-xs text-indigo-600 hover:bg-indigo-50 flex items-center transition-colors font-semibold"
                    >
                      <Smartphone className="w-4 h-4 mr-2" /> Instalar Aplicación
                    </button>
                    <div className="h-px bg-slate-100 my-1"></div>
                  </>
                )}

                {!currentUser?.isOfficeUser && (
                  <>
                    <button 
                      onClick={handleOpenSettings}
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center transition-colors font-medium"
                    >
                       <Settings className="w-4 h-4 mr-2 text-slate-400" /> Configuración General
                    </button>
                    <div className="h-px bg-slate-100 my-1"></div>
                  </>
                )}
                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center transition-colors font-medium"
                >
                   <LogOut className="w-4 h-4 mr-2" /> Cerrar Sesión
                </button>
             </div>
          )}

          <button 
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center w-full p-2 rounded-lg bg-white border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 transition-all text-left shadow-xs"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs shrink-0">
              {currentUser.firstName.charAt(0)}{currentUser.lastName.charAt(0)}
            </div>
            <div className="ml-2.5 overflow-hidden flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate leading-tight">{currentUser.firstName} {currentUser.lastName}</p>
              <p className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">{currentUser.position || 'Colaborador'}</p>
            </div>
            <ChevronUp className={`w-3.5 h-3.5 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-slate-50">
        
        {/* Executive Top Header */}
        <header className="bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="lg:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Abrir Menú"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-slate-400 hidden sm:inline">Mi Oficina</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-800 text-sm tracking-tight">{currentTabLabel}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            
            {/* Status & Version Indicator */}
            <div 
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200/80 text-[11px] font-medium text-slate-600 cursor-default"
              title={isOnline ? "Conectado a la Base de Datos en tiempo real" : "Sin conexión a Internet"}
            >
               <span 
                 className={`w-2 h-2 rounded-full transition-colors ${!isOnline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} 
               />
               <span className="font-mono text-[10.5px]">v{appVersion}</span>
               {!isOnline && <span className="text-amber-600 font-semibold text-[10px] ml-0.5">(Offline)</span>}
            </div>

            {/* Help / Mascot Icon shortcut if Mascot exists */}
            {mascotaUrl && (
              <button 
                onClick={() => handleTabChange('mascota')}
                className="w-7 h-7 rounded-full overflow-hidden border border-slate-200 hover:border-slate-400 transition-colors"
                title={mascotaName}
              >
                <img src={mascotaUrl} alt={mascotaName} className="w-full h-full object-cover" />
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 overflow-auto bg-slate-50/60 pb-20 lg:pb-6">
          {renderContent()}
        </div>

        {/* Clean Mobile Bottom Navigation Bar */}
        {!currentUser?.isOfficeUser && (
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 px-2 py-1.5 flex items-center justify-around shadow-sm">
            {navItems
              .filter(item => mobileNavSections.includes(item.id))
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-colors ${
                      isActive 
                        ? 'text-slate-900 font-semibold' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <div className={`p-1 rounded-md transition-colors ${isActive ? 'bg-slate-100 text-slate-900' : ''}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[56px]">
                      {item.label.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
          </nav>
        )}
      </main>

    </div>
  );
}

export default App;
