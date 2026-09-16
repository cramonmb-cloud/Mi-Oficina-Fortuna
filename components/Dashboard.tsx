
import React, { useMemo, useState, useEffect } from 'react';
import { 
  Users, 
  DollarSign, 
  CheckSquare, 
  Calendar,
  AlertCircle,
  Clock,
  Gift,
  Cake,
  Download,
  Loader2,
  Sparkles,
  RefreshCw,
  Wand2, // Added Wand icon
  MessageSquare,
  Sliders,
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarDays
} from 'lucide-react';
import { Employee, Expense, Task, TaskStatus, VacationRequest } from '../types';
import { generateMascotaImage, generateMascotaVideo } from '../services/geminiService';
import { 
  getDailyBirthdayCard, 
  saveDailyBirthdayCard, 
  saveDailyBirthdayVideo,
  subscribeToVacationRequests
} from '../services/dbService';
import { AppleClockWeatherWidget } from './AppleClockWeatherWidget';

interface ModuleVisibility {
  appleClockWeather?: boolean;
  weeklyPermits: boolean;
  priorityTasks: boolean;
  upcomingDeliveries: boolean;
  birthdaysMonthCard: boolean;
  kpiTotalEmployees: boolean;
  kpiMonthExpenses: boolean;
  kpiPendingTasks: boolean;
  kpiMonthBirthdays: boolean;
}

const DEFAULT_VISIBILITY: ModuleVisibility = {
  appleClockWeather: true,
  weeklyPermits: true,
  priorityTasks: true,
  upcomingDeliveries: true,
  birthdaysMonthCard: true,
  kpiTotalEmployees: true,
  kpiMonthExpenses: true,
  kpiPendingTasks: true,
  kpiMonthBirthdays: true
};

interface DashboardProps {
  currentUser: Employee; // Added currentUser to props
  employees: Employee[];
  expenses: Expense[];
  tasks: Task[];
  mascotaUrl: string;
  mascotaName: string;
  companyName: string;
  birthdayPrompt?: string;
  birthdayVideoPrompt?: string;
  birthdayWhatsAppTemplate?: string;
  selectedBdayEmployeeId?: string | null;
  setSelectedBdayEmployeeId?: (employeeId: string | null) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  currentUser, 
  employees, 
  expenses, 
  tasks, 
  mascotaUrl, 
  mascotaName, 
  companyName, 
  birthdayPrompt,
  birthdayVideoPrompt,
  birthdayWhatsAppTemplate,
  selectedBdayEmployeeId,
  setSelectedBdayEmployeeId
}) => {
  
  // Birthday Logic State
  const [birthdayImage, setBirthdayImage] = useState<string | null>(null);
  const [birthdayVideo, setBirthdayVideo] = useState<string | null>(null);
  const [generatingBday, setGeneratingBday] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState<string>('');
  
  // State for manually selected person to generate card
  const [manualSelection, setManualSelection] = useState<Employee | null>(null);

  // Vacation/Permits state for Calendario Semanal de Permisos
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date());

  // Subscription to vacations
  useEffect(() => {
    const unsubscribe = subscribeToVacationRequests(
      (data) => setVacationRequests(data),
      (err) => console.error("Error subscribing to vacation requests in Dashboard:", err)
    );
    return () => unsubscribe();
  }, []);

  // Module visibility customization state
  const [visibleModules, setVisibleModules] = useState<ModuleVisibility>(() => {
    try {
      const saved = localStorage.getItem('mi_oficina_dashboard_modules_v2');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Error parsing visibleModules", e);
    }
    return DEFAULT_VISIBILITY;
  });

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [tempVisibleModules, setTempVisibleModules] = useState<ModuleVisibility>(visibleModules);

  const handleSaveModulesVisibility = (newVisibility: ModuleVisibility) => {
    setVisibleModules(newVisibility);
    localStorage.setItem('mi_oficina_dashboard_modules_v2', JSON.stringify(newVisibility));
    setIsAdjustModalOpen(false);
  };

  useEffect(() => {
    if (selectedBdayEmployeeId) {
      const emp = employees.find(e => e.id === selectedBdayEmployeeId);
      if (emp) {
        setManualSelection(emp);
      }
      if (setSelectedBdayEmployeeId) {
        setSelectedBdayEmployeeId(null);
      }
    }
  }, [selectedBdayEmployeeId, employees, setSelectedBdayEmployeeId]);

  // Calculate Metrics
  const totalExpenses = useMemo(() => expenses.reduce((acc, curr) => acc + curr.amount, 0), [expenses]);
  const pendingTasks = useMemo(() => tasks.filter(t => t.status !== TaskStatus.DONE).length, [tasks]);

  // Generate 7 days of the week (Monday to Sunday)
  const weekDays = useMemo(() => {
    const current = new Date(currentWeekStart);
    const day = current.getDay();
    // Sunday is 0, Monday is 1, etc.
    const distance = day === 0 ? -6 : 1 - day;
    const monday = new Date(current);
    monday.setDate(current.getDate() + distance);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentWeekStart]);

  const changeWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => {
      const nextDate = new Date(prev);
      nextDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
      return nextDate;
    });
  };

  const resetToCurrentWeek = () => {
    setCurrentWeekStart(new Date());
  };

  const formatDateISO = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDayName = (d: Date) => {
    const names = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return names[d.getDay()];
  };

  const getPermitsForDate = (date: Date) => {
    const dateStr = formatDateISO(date);
    return vacationRequests.filter(req => {
      if (req.status === 'Rechazado') return false;
      return dateStr >= req.startDate && dateStr <= req.endDate;
    });
  };

  const getPermitBadgeStyle = (type: string, status: string) => {
    const base = "text-[10px] font-bold px-1.5 py-0.5 rounded border transition-all text-center select-none ";
    const isPending = status === 'Pendiente';
    
    if (type === 'Vacaciones') {
      return base + (isPending 
        ? "bg-emerald-50/50 text-emerald-600 border-dashed border-emerald-300" 
        : "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm");
    }
    if (type === 'Incapacidad') {
      return base + (isPending 
        ? "bg-rose-50/50 text-rose-600 border-dashed border-rose-300" 
        : "bg-rose-50 text-rose-700 border-rose-200 shadow-sm");
    }
    // Default 'Permiso'
    return base + (isPending 
      ? "bg-amber-50/50 text-amber-600 border-dashed border-amber-300" 
      : "bg-amber-50 text-amber-700 border-amber-200 shadow-sm");
  };

  // Helper to get greeting name (First Name + First Last Name)
  const greetingName = useMemo(() => {
    const first = currentUser.firstName.split(' ')[0];
    const last = currentUser.lastName.split(' ')[0];
    return `${first} ${last}`;
  }, [currentUser]);

  const { monthBirthdays, todayBirthdays } = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentDay = today.getDate(); // 1-31

    const month = employees.filter(e => {
      // Robust date parsing for YYYY-MM-DD strings
      if (!e.birthDate) return false;
      const [y, m, d] = e.birthDate.split('-').map(Number);
      return (m - 1) === currentMonth;
    }).sort((a, b) => {
      const dayA = parseInt(a.birthDate.split('-')[2]);
      const dayB = parseInt(b.birthDate.split('-')[2]);
      return dayA - dayB;
    });

    const todayList = month.filter(e => {
       const day = parseInt(e.birthDate.split('-')[2]);
       return day === currentDay;
    });

    return { monthBirthdays: month, todayBirthdays: todayList };
  }, [employees]);

  // Determine who is currently being displayed in the Hero Section
  const displayPerson = useMemo(() => {
    return manualSelection || (todayBirthdays.length > 0 ? todayBirthdays[0] : null);
  }, [manualSelection, todayBirthdays]);

  // Upcoming tasks logic
  const upcomingTasks = useMemo(() => {
    return tasks
      .filter(t => t.status !== TaskStatus.DONE)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [tasks]);

  // Helper to fetch and convert image to Base64
  const urlToBase64 = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Error fetching base64", e);
      return "";
    }
  };

  const [activeMediaTab, setActiveMediaTab] = useState<'image' | 'video'>('image');

  // Function to generate the card
  const generateCardForPerson = async (person: Employee) => {
    if (generatingBday || !mascotaUrl) return;
    
    setGeneratingBday(true);
    try {
      const base64Ref = await urlToBase64(mascotaUrl);
      if (base64Ref) {
        // Use custom prompt if available, otherwise use default
        const defaultPrompt = `Genera una tarjeta de felicitación de cumpleaños estilo Render 3D Pixar de ALTA CALIDAD.
        
        ELEMENTOS:
        1. TEXTO: En la parte superior, grande, 3D y brillante: "Feliz Cumpleaños ${person.firstName} ${person.lastName}". El texto debe ser el protagonista.
        2. PERSONAJE: La mascota debe estar feliz, celebrando con brazos abiertos, gorro de fiesta.
        3. AMBIENTE: Fondo festivo con desenfoque (bokeh), confeti cayendo, globos de colores vivos (Predominantemente AZULES, dorados y blancos). Iluminación de estudio cálida y mágica.
        
        Composición centrada, estilo profesional y alegre. Evita el color rosa.`;

        const finalPrompt = birthdayPrompt 
          ? birthdayPrompt
              .replace(/\${person.firstName}/g, person.firstName)
              .replace(/\${person.lastName}/g, person.lastName)
              .replace(/\${person.position}/g, person.position || '')
              .replace(/\${person.plaza}/g, person.plaza || '')
              .replace(/\${person.groupName}/g, person.groupName || '')
          : defaultPrompt;
        
        const result = await generateMascotaImage(base64Ref, finalPrompt);
        if (result.imageUrl) {
          setBirthdayImage(result.imageUrl);
          // Save to Database so everyone sees the same image
          await saveDailyBirthdayCard(person.id, result.imageUrl);
        } else {
          alert(`Error generando tarjeta: ${result.error || 'Ocurrió un error desconocido'}`);
        }
      }
    } catch (error) {
      console.error("Error generating auto birthday image", error);
    } finally {
      setGeneratingBday(false);
    }
  };

  // Function to generate the video
  const generateVideoForPerson = async (person: Employee) => {
    if (generatingVideo || !mascotaUrl) return;
    
    setGeneratingVideo(true);
    setVideoProgress("Preparando animación...");
    try {
      const base64Ref = await urlToBase64(mascotaUrl);
      if (base64Ref) {
        // Use custom prompt if available, otherwise use default
        const defaultVideoPrompt = `Genera un video en bucle de 5 segundos estilo animación 3D Pixar de ALTA CALIDAD.
La mascota es un adorable personaje que celebra felizmente con gorro de fiesta el cumpleaños de ${person.firstName} ${person.lastName}.
La mascota salta de alegría sonriendo a la cámara, rodeada de confeti brillante que cae lentamente y globos de colores flotantes en un ambiente festivo y cálido.`;

        const finalPrompt = birthdayVideoPrompt 
          ? birthdayVideoPrompt
              .replace(/\${person.firstName}/g, person.firstName)
              .replace(/\${person.lastName}/g, person.lastName)
              .replace(/\${person.position}/g, person.position || '')
              .replace(/\${person.plaza}/g, person.plaza || '')
              .replace(/\${person.groupName}/g, person.groupName || '')
          : defaultVideoPrompt;
        
        const result = await generateMascotaVideo(base64Ref, finalPrompt, (msg) => {
          setVideoProgress(msg);
        });

        if (result.videoUrl) {
          setBirthdayVideo(result.videoUrl);
          // Save to Database so everyone sees the same video
          await saveDailyBirthdayVideo(person.id, result.videoUrl);
        } else if (result.error) {
          alert(`Error generando video: ${result.error}`);
        }
      }
    } catch (error) {
      console.error("Error generating auto birthday video", error);
    } finally {
      setGeneratingVideo(false);
      setVideoProgress("");
    }
  };

  // Logic to load image and video when displayPerson changes
  useEffect(() => {
    const loadPersonMedia = async () => {
      if (displayPerson && mascotaUrl) {
        setBirthdayImage(null); // Clear previous while loading
        setBirthdayVideo(null);
        
        // 1. Check DB first
        const sharedMedia = await getDailyBirthdayCard(displayPerson.id);
        
        if (sharedMedia) {
          setBirthdayImage(sharedMedia.imageUrl);
          setBirthdayVideo(sharedMedia.videoUrl);
          
          // Auto set active tab based on what's available
          if (sharedMedia.videoUrl) {
            setActiveMediaTab('video');
          } else {
            setActiveMediaTab('image');
          }
        } else {
          setActiveMediaTab('image');
        }
      }
    };
    loadPersonMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayPerson?.id, mascotaUrl]);

  const handleManualSelect = (emp: Employee) => {
    setManualSelection(emp);
    // Smooth scroll to top of the scroll container to see the generated card
    const scrollContainer = document.querySelector('.overflow-auto') || window;
    scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRegenerate = () => {
    if (displayPerson) {
      setBirthdayImage(null); 
      generateCardForPerson(displayPerson); 
    }
  };

  const handleRegenerateVideo = () => {
    if (displayPerson) {
      setBirthdayVideo(null);
      generateVideoForPerson(displayPerson);
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch(priority) {
      case 'Alta': return 'text-red-600 bg-red-50 border-red-200';
      case 'Media': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const downloadImage = () => {
    if (birthdayImage) {
      const link = document.createElement('a');
      link.href = birthdayImage;
      link.download = `cumpleanos-${displayPerson?.firstName || 'tarjeta'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const downloadVideo = () => {
    if (birthdayVideo) {
      const link = document.createElement('a');
      link.href = birthdayVideo;
      link.download = `cumpleanos-${displayPerson?.firstName || 'video'}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSendWhatsApp = () => {
    if (!displayPerson?.email) return;
    const cleanPhone = displayPerson.email.replace(/\D/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone;
    
    let text = '';
    if (birthdayWhatsAppTemplate) {
      text = birthdayWhatsAppTemplate
        .replace(/\${person\.firstName}/g, displayPerson.firstName || '')
        .replace(/\${person\.lastName}/g, displayPerson.lastName || '')
        .replace(/\${person\.position}/g, displayPerson.position || '')
        .replace(/\${person\.plaza}/g, displayPerson.plaza || '')
        .replace(/\${companyName}/g, companyName || '')
        .replace(/\${mascotaName}/g, mascotaName || '');
    } else {
      text = `¡Feliz Cumpleaños, ${displayPerson.firstName}! 🎉🎂 Te deseamos lo mejor en este día tan especial de parte de todo el equipo. ✨🎈`;
    }
    
    if (activeMediaTab === 'image' && birthdayImage && birthdayImage.startsWith('http')) {
      text += `\n\nAquí tienes tu tarjeta de felicitación: ${birthdayImage}`;
    } else if (activeMediaTab === 'video' && birthdayVideo && birthdayVideo.startsWith('http')) {
      text += `\n\nAquí tienes tu video de felicitación: ${birthdayVideo}`;
    }
    
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const visibleKpisCount = [
    visibleModules.kpiTotalEmployees,
    visibleModules.kpiMonthExpenses,
    visibleModules.kpiPendingTasks,
    visibleModules.kpiMonthBirthdays
  ].filter(Boolean).length;

  const kpiGridClass = visibleKpisCount === 4 
    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
    : visibleKpisCount === 3
    ? "grid grid-cols-1 md:grid-cols-3 gap-6"
    : visibleKpisCount === 2
    ? "grid grid-cols-1 md:grid-cols-2 gap-6"
    : "grid grid-cols-1 gap-6";

  const showLeftCol = visibleModules.priorityTasks || visibleModules.upcomingDeliveries;
  const showRightCol = visibleModules.birthdaysMonthCard;
  
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in">
      
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-2">
        <div className="flex items-center gap-3.5">
          {mascotaUrl && (
            <div className="w-11 h-11 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-xs shrink-0">
              <img src={mascotaUrl} alt={mascotaName} className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Hola, {greetingName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Resumen de operaciones y estado general de la oficina</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <button
            onClick={() => {
              setTempVisibleModules({...visibleModules});
              setIsAdjustModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs transition-all text-xs font-semibold"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Personalizar Vista</span>
          </button>
          <span className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs shrink-0 font-medium capitalize">
            {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>
      
      {/* Reloj Digital Tipo Apple y Clima de Ciudad Guzmán */}
      {visibleModules.appleClockWeather !== false && (
        <AppleClockWeatherWidget />
      )}

      {/* Birthday Special Section */}
      {displayPerson && (
        <div className="bg-slate-900 rounded-2xl shadow-sm text-white overflow-hidden relative transition-all">
          {/* Close button for manual selection */}
          {manualSelection && (
            <button 
              onClick={() => setManualSelection(null)}
              className="absolute top-4 right-4 z-20 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg p-1.5 transition-colors"
              title="Cerrar vista previa"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="p-6 sm:p-8 flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 bg-slate-800 text-amber-300 border border-slate-700 px-3 py-1 rounded-full text-xs font-semibold mb-3 tracking-wide">
                <Cake className="w-3.5 h-3.5 text-amber-400" /> 
                {todayBirthdays.some(t => t.id === displayPerson.id) ? "¡Cumpleaños Hoy!" : "Celebración de Cumpleaños"}
              </div>
              
              <h3 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center flex-wrap justify-center md:justify-start gap-2.5">
                <span>{displayPerson.firstName} {displayPerson.lastName}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                  (displayPerson.status || 'ACTIVO') === 'ACTIVO' 
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300' 
                    : 'bg-amber-950/80 border-amber-500 text-amber-300'
                }`}>
                  {displayPerson.status || 'ACTIVO'}
                </span>
              </h3>
              
              <p className="text-slate-300 text-sm mb-6 max-w-lg">
                Puesto: <span className="font-semibold text-white">{displayPerson.position}</span> • Plaza: <span className="font-semibold text-white">{displayPerson.plaza || 'Principal'}</span>
              </p>

              {/* Subtabs image / video */}
              <div className="flex items-center justify-center md:justify-start gap-2 mb-6">
                <button 
                  onClick={() => setActiveMediaTab('image')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeMediaTab === 'image' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Tarjeta Imagen
                </button>
                <button 
                  onClick={() => setActiveMediaTab('video')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeMediaTab === 'video' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Video Animado
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2.5 justify-center md:justify-start">
                {activeMediaTab === 'image' ? (
                  birthdayImage ? (
                    <>
                      <button 
                        onClick={downloadImage}
                        className="bg-white hover:bg-slate-100 text-slate-900 px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" /> Descargar Tarjeta
                      </button>
                      {displayPerson?.email && (
                        <button 
                          onClick={handleSendWhatsApp}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center shadow-xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Enviar WhatsApp
                        </button>
                      )}
                      <button 
                        onClick={handleRegenerate}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerar
                      </button>
                    </>
                  ) : (
                    displayPerson?.email && (
                      <button 
                        onClick={handleSendWhatsApp}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center"
                      >
                        <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Enviar WhatsApp
                      </button>
                    )
                  )
                ) : (
                  birthdayVideo ? (
                    <>
                      <button 
                        onClick={downloadVideo}
                        className="bg-white hover:bg-slate-100 text-slate-900 px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" /> Descargar Video
                      </button>
                      {displayPerson?.email && (
                        <button 
                          onClick={handleSendWhatsApp}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center shadow-xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Enviar WhatsApp
                        </button>
                      )}
                      <button 
                        onClick={handleRegenerateVideo}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerar
                      </button>
                    </>
                  ) : (
                    displayPerson?.email && (
                      <button 
                        onClick={handleSendWhatsApp}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center"
                      >
                        <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Enviar WhatsApp
                      </button>
                    )
                  )
                )}
              </div>
            </div>

            {/* Generated Media Box */}
            <div className="w-full md:w-80 h-64 bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-slate-700 relative group shrink-0">
              {activeMediaTab === 'image' ? (
                birthdayImage ? (
                  <>
                    <img src={birthdayImage} alt="Tarjeta Cumpleaños" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-xs font-semibold text-white flex items-center"><Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-400"/> Generado por {mascotaName}</p>
                    </div>
                  </>
                ) : generatingBday ? (
                  <div className="text-center p-4">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-200">Generando tarjeta...</p>
                  </div>
                ) : !mascotaUrl ? (
                  <div className="text-center p-4 text-slate-400 text-xs">
                     Configura la mascota en Ajustes para generar tarjetas.
                  </div>
                ) : (
                  <div className="text-center p-6 flex flex-col items-center justify-center h-full">
                    <Gift className="w-8 h-8 text-slate-500 mb-2.5" />
                    <p className="text-slate-300 text-xs mb-3">Generar tarjeta personalizada</p>
                    <button 
                      onClick={() => generateCardForPerson(displayPerson)}
                      className="bg-white hover:bg-slate-100 text-slate-900 px-4 py-1.5 rounded-lg font-semibold text-xs transition-colors"
                    >
                      Generar Imagen
                    </button>
                  </div>
                )
              ) : (
                birthdayVideo ? (
                  <>
                    <video src={birthdayVideo} controls className="w-full h-full object-cover" loop autoPlay muted playsInline />
                    <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 p-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[11px] font-semibold text-white flex items-center justify-center"><Wand2 className="w-3 h-3 mr-1 text-indigo-400"/> Google Veo</p>
                    </div>
                  </>
                ) : generatingVideo ? (
                  <div className="text-center p-4">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-200">Generando video animado...</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">{videoProgress}</p>
                  </div>
                ) : !mascotaUrl ? (
                  <div className="text-center p-4 text-slate-400 text-xs">
                     Configura la mascota en Ajustes para generar videos.
                  </div>
                ) : (
                  <div className="text-center p-6 flex flex-col items-center justify-center h-full">
                    <Wand2 className="w-8 h-8 text-slate-500 mb-2.5" />
                    <p className="text-slate-300 text-xs mb-3">Generar felicitación con video</p>
                    <button 
                      onClick={() => generateVideoForPerson(displayPerson)}
                      className="bg-white hover:bg-slate-100 text-slate-900 px-4 py-1.5 rounded-lg font-semibold text-xs transition-colors"
                    >
                      Generar Video
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {visibleKpisCount > 0 && (
        <div className={kpiGridClass}>
          {visibleModules.kpiTotalEmployees && (
            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:border-slate-300">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Personal Activo</p>
                <h3 className="text-2xl font-bold font-mono text-slate-900 mt-1">{employees.length}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Colaboradores registrados</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700">
                <Users className="w-5 h-5" />
              </div>
            </div>
          )}

          {visibleModules.kpiMonthExpenses && (
            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:border-slate-300">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Gastos del Mes</p>
                <h3 className="text-2xl font-bold font-mono text-slate-900 mt-1">${totalExpenses.toLocaleString()}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Monto total devengado</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          )}

          {visibleModules.kpiPendingTasks && (
            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:border-slate-300">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tareas Pendientes</p>
                <h3 className="text-2xl font-bold font-mono text-slate-900 mt-1">{pendingTasks}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Pendientes de resolución</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
                <CheckSquare className="w-5 h-5" />
              </div>
            </div>
          )}

          {visibleModules.kpiMonthBirthdays && (
            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:border-slate-300">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cumpleaños Mes</p>
                <h3 className="text-2xl font-bold font-mono text-slate-900 mt-1">{monthBirthdays.length}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Festejos programados</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Calendario Semanal de Permisos */}
      {visibleModules.weeklyPermits && (
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-slate-700" />
                Calendario Semanal de Permisos y Vacaciones
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Permisos, ausencias e incapacidades programadas</p>
            </div>
            
            <div className="flex items-center gap-1.5 self-start sm:self-center">
              <button 
                onClick={() => changeWeek('prev')}
                className="p-1.5 hover:bg-slate-100 rounded-md border border-slate-200 text-slate-600 transition-colors"
                title="Semana anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={resetToCurrentWeek}
                className="px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 rounded-md border border-slate-200 text-slate-700 transition-colors"
              >
                Semana Actual
              </button>
              <button 
                onClick={() => changeWeek('next')}
                className="p-1.5 hover:bg-slate-100 rounded-md border border-slate-200 text-slate-600 transition-colors"
                title="Semana siguiente"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-2.5">
            {weekDays.map((day, idx) => {
              const dayPermits = getPermitsForDate(day);
              const isToday = formatDateISO(day) === formatDateISO(new Date());
              
              return (
                <div 
                  key={idx} 
                  className={`p-3 rounded-lg border flex flex-col min-h-[130px] transition-all ${
                    isToday 
                      ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-slate-900' : 'text-slate-400'}`}>
                      {getDayName(day)}
                    </span>
                    <span className={`text-xs font-mono font-bold h-5 w-5 flex items-center justify-center rounded-md ${
                      isToday ? 'bg-slate-900 text-white' : 'text-slate-700'
                    }`}>
                      {day.getDate()}
                    </span>
                  </div>
                  
                  <div className="flex-1 space-y-1 overflow-y-auto max-h-[100px] pr-0.5 custom-scrollbar">
                    {dayPermits.length === 0 ? (
                      <div className="h-full flex items-center justify-center py-4">
                        <span className="text-[10px] text-slate-400 font-medium">Sin incidencias</span>
                      </div>
                    ) : (
                      dayPermits.map(req => {
                        const emp = employees.find(e => e.id === req.employeeId);
                        const empName = emp ? `${emp.firstName}` : 'Colaborador';
                        return (
                          <div 
                            key={req.id} 
                            className={getPermitBadgeStyle(req.type, req.status)}
                            title={`${empName} - ${req.type} (${req.status})\n${req.startDate} al ${req.endDate}${req.notes ? '\nNotas: ' + req.notes : ''}`}
                          >
                            <span className="truncate font-bold text-slate-800 leading-tight block">{empName}</span>
                            <span className="text-[8px] font-medium uppercase mt-0.5 leading-none block">{req.type}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      {(showLeftCol || showRightCol) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Col: Tasks */}
          {showLeftCol && (
            <div className={`${showRightCol ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-6`}>
              {/* Priority Tasks */}
              {visibleModules.priorityTasks && (
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col">
                  <h3 className="text-sm font-bold text-slate-900 mb-3.5 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2 text-rose-500" /> Tareas de Alta Prioridad
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {tasks.filter(t => t.priority === 'Alta' && t.status !== TaskStatus.DONE).length === 0 ? (
                      <div className="col-span-full p-6 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        <p className="text-xs text-slate-400 font-medium">Sin tareas urgentes pendientes</p>
                      </div>
                    ) : (
                      tasks
                      .filter(t => t.priority === 'Alta' && t.status !== TaskStatus.DONE)
                      .map(task => (
                        <div key={task.id} className="p-3.5 border border-rose-200 bg-rose-50/40 rounded-lg">
                          <div className="flex justify-between items-start mb-1.5">
                            <h4 className="font-semibold text-xs text-slate-900 line-clamp-1">{task.title}</h4>
                            <span className="text-[10px] font-mono font-medium text-rose-700 bg-white px-1.5 py-0.5 rounded border border-rose-200 whitespace-nowrap">{task.dueDate}</span>
                          </div>
                          <p className="text-xs text-slate-500">{employees.find(e => e.id === task.assignedTo)?.firstName || 'Sin asignar'}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Upcoming Tasks Table */}
              {visibleModules.upcomingDeliveries && (
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-3.5 flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-slate-600" /> Próximas Entregas y Vencimientos
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-100">
                          <th className="pb-2.5 pl-1">Tarea</th>
                          <th className="pb-2.5">Responsable</th>
                          <th className="pb-2.5">Fecha</th>
                          <th className="pb-2.5">Prioridad</th>
                          <th className="pb-2.5 text-right pr-1">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs divide-y divide-slate-100">
                        {upcomingTasks.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-400 font-medium">
                              No hay tareas próximas programadas.
                            </td>
                          </tr>
                        ) : (
                          upcomingTasks.map(task => (
                            <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2.5 pl-1 font-medium text-slate-800">{task.title}</td>
                              <td className="py-2.5 text-slate-600">
                                <div className="flex items-center">
                                  <div className="w-5 h-5 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 mr-2">
                                    {(employees.find(e => e.id === task.assignedTo)?.firstName?.charAt(0) || '?')}
                                  </div>
                                  <span>{employees.find(e => e.id === task.assignedTo)?.firstName || 'Sin asignar'}</span>
                                </div>
                              </td>
                              <td className="py-2.5 text-slate-500 font-mono">
                                {task.dueDate}
                              </td>
                              <td className="py-2.5">
                                <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-wide ${getPriorityStyle(task.priority)}`}>
                                  {task.priority}
                                </span>
                              </td>
                              <td className="py-2.5 text-right pr-1">
                                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                  task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {task.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right Col: Birthdays */}
          {showRightCol && (
            <div className={showLeftCol ? 'lg:col-span-1' : 'lg:col-span-3'}>
              <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs h-full flex flex-col">
                <h3 className="text-sm font-bold text-slate-900 mb-3.5 flex items-center">
                  <Gift className="w-4 h-4 mr-2 text-slate-600" /> Cumpleaños del Mes
                </h3>
                
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                  {monthBirthdays.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs font-medium">
                      No hay cumpleaños registrados este mes.
                    </div>
                  ) : (
                    monthBirthdays.map(emp => {
                      const day = parseInt(emp.birthDate.split('-')[2]);
                      const isToday = todayBirthdays.some(t => t.id === emp.id);

                      return (
                        <div key={emp.id} className={`flex items-center justify-between p-2.5 rounded-lg transition-all ${isToday ? 'bg-slate-50 border border-slate-900' : 'hover:bg-slate-50 border border-slate-100'}`}>
                          <div className="flex items-center flex-1 min-w-0">
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center font-mono font-bold text-xs mr-2.5 shrink-0 ${isToday ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              {day}
                            </div>
                            <div className="truncate pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className={`font-semibold text-xs truncate ${isToday ? 'text-slate-900' : 'text-slate-800'}`}>
                                  {emp.firstName} {emp.lastName}
                                </p>
                              </div>
                              <p className="text-[10px] text-slate-400 truncate">{emp.position}</p>
                            </div>
                          </div>
                          
                          {/* Generar Evaristo Button */}
                          <button 
                            onClick={() => handleManualSelect(emp)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors shrink-0"
                            title={`Generar felicitación para ${emp.firstName}`}
                          >
                             <Wand2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
                
                <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                   <p className="text-[11px] text-slate-400 italic">"Los pequeños detalles construyen grandes equipos"</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Adjust Panel Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Personalizar Panel</h3>
              </div>
              <button 
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors text-xs"
              >
                ✕
              </button>
            </div>
            
            <div className="p-5 space-y-4 max-h-[400px] overflow-y-auto">
              <p className="text-xs text-slate-500 mb-2">Selecciona los módulos visibles en tu panel de control.</p>
              
              <div className="space-y-2.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Módulos Principales</div>
                
                {[
                  { key: 'appleClockWeather', label: 'Reloj y Clima en Vivo', desc: 'Reloj digital tipo Apple y clima de Ciudad Guzmán' },
                  { key: 'weeklyPermits', label: 'Calendario Semanal de Permisos', desc: 'Vacaciones y ausencias de la semana' },
                  { key: 'priorityTasks', label: 'Tareas Prioritarias', desc: 'Alertas de tareas urgentes' },
                  { key: 'upcomingDeliveries', label: 'Próximas Entregas', desc: 'Entregas programadas cercanas' },
                  { key: 'birthdaysMonthCard', label: 'Cumpleaños del Mes', desc: 'Módulo de felicitaciones' },
                ].map((mod) => (
                  <div key={mod.key} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/70">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{mod.label}</p>
                      <p className="text-[10px] text-slate-400">{mod.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTempVisibleModules(prev => ({
                          ...prev,
                          [mod.key]: !prev[mod.key as keyof ModuleVisibility]
                        }));
                      }}
                      className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-all ${
                        tempVisibleModules[mod.key as keyof ModuleVisibility] ? 'bg-slate-900 justify-end' : 'bg-slate-300 justify-start'
                      }`}
                    >
                      <span className="w-4 h-4 bg-white rounded-full shadow-xs"></span>
                    </button>
                  </div>
                ))}

                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-2">Indicadores KPI</div>
                
                {[
                  { key: 'kpiTotalEmployees', label: 'Personal Activo', desc: 'Total de colaboradores' },
                  { key: 'kpiMonthExpenses', label: 'Gastos del Mes', desc: 'Total de gastos devengados' },
                  { key: 'kpiPendingTasks', label: 'Tareas Pendientes', desc: 'Tareas activas inconclusas' },
                  { key: 'kpiMonthBirthdays', label: 'Cumpleaños (Mes)', desc: 'Cumpleañeros del mes actual' },
                ].map((mod) => (
                  <div key={mod.key} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/70">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{mod.label}</p>
                      <p className="text-[10px] text-slate-400">{mod.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTempVisibleModules(prev => ({
                          ...prev,
                          [mod.key]: !prev[mod.key as keyof ModuleVisibility]
                        }));
                      }}
                      className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-all ${
                        tempVisibleModules[mod.key as keyof ModuleVisibility] ? 'bg-slate-900 justify-end' : 'bg-slate-300 justify-start'
                      }`}
                    >
                      <span className="w-4 h-4 bg-white rounded-full shadow-xs"></span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSaveModulesVisibility(tempVisibleModules)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
