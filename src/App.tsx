/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { 
  LayoutGrid, 
  Palette, 
  History, 
  Send, 
  Plus, 
  Download, 
  RefreshCw, 
  HelpCircle,
  Check, 
  AlertCircle, 
  Image as ImageIcon,
  Type,
  Square,
  RectangleVertical,
  Monitor,
  LogOut,
  User,
  Copy,
  Instagram,
  Loader2,
  Sparkles,
  Search,
  Zap,
  Smartphone,
  ChevronRight,
  Upload,
  Pencil,
  Menu,
  X,
  Cpu,
  CreditCard,
  Eye,
  EyeOff,
  MessageCircle,
  Calendar,
  MoreVertical
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase, GEMINI_API_KEY } from './config';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

type Tab = 'geracao' | 'agendamento' | 'marca' | 'historico';
type Format = 'texto' | 'quadrado' | 'retrato' | 'story';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  credits_balance: number;
}

interface BrandSettings {
  colors: string[];
  logo_url: string;
  reference_images: string; // JSON string of URL array
  tone_of_voice: string;
  brand_personality: string;
  personality: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  timestamp: number;
}

// --- Components ---

const Toast = ({ message, type = 'success', onClose }: { message: string, type?: 'success' | 'error' | 'warning', onClose: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 20 }}
    className={cn(
      "fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 z-50",
      type === 'success' ? "bg-emerald-600" : type === 'warning' ? "bg-orange-600" : "bg-red-600"
    )}
  >
    {type === 'success' ? <Check size={18} /> : type === 'warning' ? <AlertCircle size={18} /> : <AlertCircle size={18} />}
    <span className="text-sm font-medium">{message}</span>
    <button onClick={onClose} className="ml-2 hover:opacity-70"><Plus size={16} className="rotate-45" /></button>
  </motion.div>
);

// --- Components ---
const ImageSelectionModal = ({ 
  isOpen, 
  onClose, 
  candidates, 
  isSearching,
  onSelectLogo,
  onAddReference,
  setSearchCandidates,
  setIsSearchingCandidates,
  handleAISearchFallback,
  showToast
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  candidates: string[], 
  isSearching: boolean,
  onSelectLogo: (url: string) => void,
  onAddReference: (url: string) => void,
  setSearchCandidates: React.Dispatch<React.SetStateAction<string[]>>,
  setIsSearchingCandidates: React.Dispatch<React.SetStateAction<boolean>>,
  handleAISearchFallback: (query: string) => Promise<any>,
  showToast: (msg: string, type?: any) => void
}) => {
  const [manualSearch, setManualSearch] = useState('');

  if (!isOpen) return null;

  const handleManualSearch = async () => {
    if (!manualSearch.trim()) return;
    setIsSearchingCandidates(true);
    showToast(`Buscando por "${manualSearch}"...`, 'warning');
    const aiData = await handleAISearchFallback(manualSearch);
    if (aiData && aiData.candidates) {
      setSearchCandidates(prev => {
        const combined = [...prev, ...aiData.candidates];
        return Array.from(new Set(combined));
      });
    }
    setIsSearchingCandidates(false);
    setManualSearch('');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-bottom border-white/5 flex flex-col sm:flex-row items-center justify-between bg-white/5 gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Sugestões de Imagens</h2>
            <p className="text-xs text-white/40 uppercase tracking-widest font-bold mt-1">Selecione o que deseja usar na sua marca</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <input 
                type="text"
                placeholder="Pesquisar no Google..."
                value={manualSearch}
                onChange={(e) => setManualSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs font-medium focus:outline-none focus:border-brand/50 transition-all placeholder:text-white/20"
              />
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20" />
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 glass rounded-full flex items-center justify-center hover:bg-white/10 transition-all shrink-0"
            >
              <Plus size={20} className="rotate-45" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {candidates.length === 0 && isSearching ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 size={40} className="text-brand animate-spin" />
              <p className="text-sm text-white/40 animate-pulse">Buscando imagens na web...</p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-white/20">
              <Search size={40} />
              <p className="text-sm">Nenhuma imagem encontrada ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {candidates.map((url, i) => (
                <div key={i} className="group relative aspect-square glass rounded-2xl overflow-hidden border border-white/5 hover:border-brand/50 transition-all">
                  <img 
                    src={`/api/proxy-image?url=${encodeURIComponent(url)}`} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    alt={`Candidate ${i}`}
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src.includes('/api/proxy-image?url=')) {
                        target.src = url; // Try direct if proxy fails
                      } else {
                        target.parentElement?.classList.add('hidden'); // Hide if both fail
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                    <button 
                      onClick={() => onSelectLogo(url)}
                      className="w-full py-2 bg-brand text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:scale-105 transition-all"
                    >
                      Usar como Logo
                    </button>
                    <button 
                      onClick={() => onAddReference(url)}
                      className="w-full py-2 bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-white/20 transition-all"
                    >
                      Add Referência
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isSearching && candidates.length > 0 && (
          <div className="px-6 py-3 bg-brand/10 border-t border-white/5 flex items-center gap-3">
            <Loader2 size={14} className="text-brand animate-spin" />
            <span className="text-[10px] font-bold text-brand uppercase tracking-widest animate-pulse">
              A IA ainda está procurando mais imagens...
            </span>
          </div>
        )}

        <div className="p-6 border-t border-white/5 bg-white/5 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition-all"
          >
            Concluir
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  // Auth State
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // App State
  const [activeTab, setActiveTab] = useState<Tab>('geracao');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [brand, setBrand] = useState<BrandSettings>({
    colors: ['#EA580C', '#f2f2f2'],
    logo_url: '',
    reference_images: '[]',
    tone_of_voice: 'Profissional',
    brand_personality: '',
    personality: ''
  });
  const [credits, setCredits] = useState(0);
  
  // Generation State
  const [selectedFormat, setSelectedFormat] = useState<Format>('quadrado');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Me diga o que você quer criar e eu gero a arte + legenda no seu estilo. Você só precisa configurar sua marca uma vez na aba "Marca".',
      timestamp: Date.now()
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<{ imageUrl: string, caption: string } | null>(null);
  const [customTone, setCustomTone] = useState('');
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const [showCreditsTooltip, setShowCreditsTooltip] = useState(false);
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    image_url: '',
    caption: '',
    date: '',
    time: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [instaHandle, setInstaHandle] = useState('');
  const [isImportingInsta, setIsImportingInsta] = useState(false);
  const [searchCandidates, setSearchCandidates] = useState<string[]>([]);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);

  // History State
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  // --- Persistent Chat Loading ---
  const loadChatHistory = async () => {
    if (!session?.user) return;
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      if (data && data.length > 0) {
        setChatMessages(data.map(m => ({
          role: m.role,
          content: m.content,
          imageUrl: m.image_url,
          timestamp: new Date(m.created_at).getTime()
        })));
      }
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  };

  // UI State
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUserData(session.user.id);
        loadChatHistory();
        loadHistory(0);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadUserData(session.user.id);
        loadChatHistory();
        loadHistory(0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadUserData = async (userId: string) => {
    if (!userId) return;
    try {
      // Load Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) throw profileError;
      setProfile(profileData);
      setCredits(profileData.credits_balance);

      // Load Brand
      const { data: brandData, error: brandError } = await supabase
        .from('brand_settings')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (brandData) {
        setBrand(brandData);
      }
    } catch (error: any) {
      console.error('Error loading user data:', error);
      showToast('Erro ao carregar dados do usuário', 'error');
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        showToast('Conta criada! Verifique seu e-mail.');
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImportInstagram = async () => {
    if (!instaHandle) {
      showToast('Por favor, insira o @ do Instagram', 'error');
      return;
    }

    setIsImportingInsta(true);
    setSearchCandidates([]);
    setIsSelectionModalOpen(true);
    setIsSearchingCandidates(true);
    
    try {
      // Step 1: Try the standard scraper
      const response = await fetch('/api/scrape-instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: instaHandle }),
      });

      let initialCandidates: string[] = [];
      if (response.ok) {
        const data = await response.json();
        if (data.logo) initialCandidates.push(data.logo);
        if (data.references) initialCandidates = [...initialCandidates, ...data.references];
      }
      
      setSearchCandidates(prev => {
        const combined = [...prev, ...initialCandidates];
        return Array.from(new Set(combined));
      });

      // Step 2: Deep Search with AI
      showToast('Buscando mais sugestões com IA...', 'warning');
      const aiData = await handleAISearchFallback(instaHandle);
      
      if (aiData && aiData.candidates) {
        setSearchCandidates(prev => {
          const combined = [...prev, ...aiData.candidates];
          return Array.from(new Set(combined));
        });
      }

      if (initialCandidates.length === 0 && (!aiData || !aiData.candidates || aiData.candidates.length === 0)) {
        showToast('Nenhuma imagem encontrada. Verifique o @.', 'error');
      }

    } catch (error: any) {
      console.error("Import error:", error);
      showToast('Erro ao buscar imagens.', 'error');
    } finally {
      setIsImportingInsta(false);
      setIsSearchingCandidates(false);
    }
  };

  const extractColorsFromLogo = (logoUrl: string) => {
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = logoUrl.startsWith('http') ? `/api/proxy-image?url=${encodeURIComponent(logoUrl)}` : logoUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const points = [[0.5, 0.5], [0.2, 0.2], [0.8, 0.8], [0.2, 0.8], [0.8, 0.2]];
        const extractedColors = points.map(([px, py]) => {
          const x = Math.floor(px * canvas.width);
          const y = Math.floor(py * canvas.height);
          const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
          return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        });
        
        const uniqueColors = [...new Set(extractedColors)].slice(0, 3);
        setBrand(prev => ({
          ...prev,
          colors: [...new Set([...uniqueColors, ...prev.colors])].slice(0, 6)
        }));
      };
    } catch (e) {
      console.warn('Could not extract colors from logo:', e);
    }
  };
  const loadScheduledPosts = async () => {
    if (!session?.user) return;
    try {
      const { data, error } = await supabase
        .from('scheduled_posts')
        .select('*')
        .eq('user_id', session.user.id)
        .order('scheduled_date', { ascending: true });
      
      if (error) throw error;
      setScheduledPosts(data || []);
    } catch (error) {
      console.error('Error loading scheduled posts:', error);
    }
  };

  const handleSchedulePost = async () => {
    if (!session?.user) return;
    if (!scheduleForm.image_url || !scheduleForm.caption || !scheduleForm.date || !scheduleForm.time) {
      showToast('Preencha todos os campos para agendar', 'error');
      return;
    }

    setIsScheduling(true);
    try {
      const { error } = await supabase
        .from('scheduled_posts')
        .insert([{
          user_id: session.user.id,
          image_url: scheduleForm.image_url,
          caption: scheduleForm.caption,
          scheduled_date: scheduleForm.date,
          scheduled_time: scheduleForm.time,
          status: 'pending'
        }]);

      if (error) throw error;

      showToast('Postagem agendada com sucesso!', 'success');
      setScheduleForm({ image_url: '', caption: '', date: '', time: '' });
      loadScheduledPosts();
    } catch (error: any) {
      showToast('Erro ao agendar: ' + error.message, 'error');
    } finally {
      setIsScheduling(false);
    }
  };

  const deleteScheduledPost = async (id: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_posts')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setScheduledPosts(prev => prev.filter(p => p.id !== id));
      showToast('Agendamento removido', 'success');
    } catch (error) {
      showToast('Erro ao remover agendamento', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'agendamento') {
      loadScheduledPosts();
    }
  }, [activeTab]);

  const handleAISearchFallback = async (handle: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      const prompt = `Você é um especialista em branding e pesquisa visual. Preciso que você encontre o máximo de imagens de alta qualidade relacionadas à marca/perfil do Instagram "${handle}".
      
      TAREFAS:
      1. Encontre a URL direta do logo oficial ou imagem de perfil.
      2. Encontre URLs de posts, banners, fotos de produtos ou qualquer elemento visual que defina a identidade da marca.
      
      REGRAS:
      - Procure no Instagram, site oficial, LinkedIn, Facebook e Google Images.
      - As URLs devem ser links DIRETOS para imagens (.jpg, .png, .webp).
      - Tente retornar pelo menos 10 a 15 URLs únicas e relevantes.
      
      Retorne APENAS um JSON no formato:
      {
        "candidates": ["URL1", "URL2", "URL3", ...],
        "brand_name": "Nome da Marca",
        "suggested_logo": "URL_DO_LOGO_MAIS_PROVAVEL"
      }`;

      const result = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        }
      });

      const text = result.text;
      console.log(`[AI Search] Response received:`, text);
      
      if (!text) return null;
      const parsed = JSON.parse(text.trim());
      
      if (!parsed.candidates || parsed.candidates.length === 0) {
        console.warn("[AI Search] AI returned no candidates");
        return null;
      }
      
      return parsed;
    } catch (e) {
      console.error("[AI Search] Fallback failed:", e);
      return null;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const getCreditCost = (format: Format) => (format === 'texto' ? 2 : 10);

  const handleSendMessage = async () => {
    if (!userInput.trim() || isGenerating) return;

    const cost = getCreditCost(selectedFormat);
    if (credits < cost) {
      showToast('Créditos insuficientes. Adicione mais créditos para continuar.', 'error');
      return;
    }

    const prompt = userInput.trim();
    const userMsg: ChatMessage = { role: 'user', content: prompt, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    setUserInput('');
    setIsGenerating(true);
    setLastResult(null);

    try {
      // 1. Prepare Brand Data
      const brandInfo = {
        colors: brand.colors,
        tone: brand.tone_of_voice,
        personality: brand.personality || brand.brand_personality,
        logoUrl: brand.logo_url,
        refs: JSON.parse(brand.reference_images || '[]')
      };

      // 2. Fetch Images as Base64 for Gemini
      const fetchAsBase64 = async (url: string) => {
        if (!url) return null;
        const resp = await fetch(url);
        const blob = await resp.blob();
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(blob);
        });
      };

      const logoBase64 = brandInfo.logoUrl ? await fetchAsBase64(brandInfo.logoUrl) : null;
      const refsBase64 = await Promise.all(brandInfo.refs.map((url: string) => fetchAsBase64(url)));
      const editBase64 = editingImage ? await fetchAsBase64(editingImage) : null;

      // 3. Build Gemini Request
      const formatLabels = {
        texto: 'caption only (no image)',
        quadrado: '1:1 square image',
        retrato: '3:4 portrait image',
        story: '9:16 story image'
      };

      const isTextOnly = selectedFormat === 'texto';

      let systemInstruction = isTextOnly 
        ? `Você é um especialista em estratégia criativa e copywriting para redes sociais da Monarca Hub. 
Sua missão é ajudar o usuário a planejar conteúdos, criar legendas, sugerir ideias de posts, calendários editoriais e alinhar estratégias de marca.
Identidade da marca do usuário:
Cores: ${brandInfo.colors.join(', ')}. Tom de voz: ${brandInfo.tone}. Personalidade: ${brandInfo.personality}.

Diretrizes:
- Responda sempre em Português Brasileiro.
- Seja criativo, estratégico e prestativo. 
- Se o usuário pedir uma legenda, forneça-a com hashtags relevantes. 
- Se ele pedir ideias ou planejamento, aja como um consultor de marketing experiente.
- Você pode sugerir legendas mesmo quando o usuário pede ideias, mas foque no que foi solicitado.
- NUNCA tente gerar imagens ou descrever prompts de imagem neste modo de texto.`
        : `You are a professional social media designer. Generate a ${formatLabels[selectedFormat]} for a brand with the following identity:
Colors: ${brandInfo.colors.join(', ')}. Tone of voice: ${brandInfo.tone}. Brand personality: ${brandInfo.personality}.
The brand logo is included as a reference image — incorporate it visibly in the composition.
The other reference images show the brand's visual style — follow that aesthetic.

CRITICAL FOR TEXT RENDERING:
- If the user asks for specific text in the image, render it clearly and accurately.
- Use simple, legible typography.
- Double-check the spelling of every word.
- Keep text elements minimal and well-spaced to avoid distortion.

DO NOT write any caption or text outside the image. Return ONLY the image data.`;

      if (editingImage && !isTextOnly) {
        systemInstruction += `\n\nIMPORTANT: You are EDITING an existing image provided as the last reference. Modify it based on the user's request while maintaining the brand style and logo.`;
      }

      // Build Chat History for Context (Ensure it starts with 'user' and alternates)
      let historyContext = chatMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content || "..." }]
      }));

      // Remove leading 'model' messages
      while (historyContext.length > 0 && historyContext[0].role === 'model') {
        historyContext.shift();
      }

      // Ensure alternating roles
      const alternatingHistory: any[] = [];
      historyContext.forEach((msg) => {
        if (alternatingHistory.length === 0 || msg.role !== alternatingHistory[alternatingHistory.length - 1].role) {
          alternatingHistory.push(msg);
        }
      });
      
      // Take last few messages and ensure it ends with 'model' so current is 'user'
      let finalHistory = alternatingHistory.slice(-6);
      if (finalHistory.length > 0 && finalHistory[finalHistory.length - 1].role === 'user') {
        finalHistory.pop();
      }

      const lastMessageParts: any[] = [{ text: prompt }];
      if (!isTextOnly) {
        if (logoBase64) lastMessageParts.push({ inlineData: { mimeType: 'image/png', data: logoBase64 } });
        refsBase64.forEach(data => {
          if (data) lastMessageParts.push({ inlineData: { mimeType: 'image/png', data } });
        });
        if (editBase64) {
          lastMessageParts.push({ inlineData: { mimeType: 'image/png', data: editBase64 } });
        }
      }

      const imageConfigMap: Record<string, string> = {
        quadrado: '1:1',
        retrato: '3:4',
        story: '9:16'
      };

      const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      
      const config: any = {
        systemInstruction: systemInstruction,
      };

      if (!isTextOnly) {
        config.imageConfig = {
          aspectRatio: imageConfigMap[selectedFormat] || '1:1',
          imageSize: "1K"
        };
      }

      const result = await genAI.models.generateContent({
        model: isTextOnly ? "gemini-3.1-pro-preview" : "gemini-3.1-flash-image-preview",
        contents: [
          ...finalHistory,
          { role: 'user', parts: lastMessageParts }
        ],
        config: config
      });

      const candidates = result.candidates?.[0]?.content?.parts || [];
      let caption = '';
      let imageBase64 = '';

      candidates.forEach((part: any) => {
        if (part.text) caption += part.text;
        if (part.inlineData) imageBase64 = part.inlineData.data;
      });

      // Clean up caption if it contains the separator
      if (caption.includes('---CAPTION---')) {
        caption = caption.split('---CAPTION---')[1].trim();
      }

      let imageUrl = '';
      if (imageBase64) {
        const blob = await (await fetch(`data:image/png;base64,${imageBase64}`)).blob();
        const timestamp = Date.now();
        const fileName = `${session.user.id}/${timestamp}.png`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('generated-arts')
          .upload(fileName, blob);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('generated-arts')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }

      // 4. Deduct Credits
      const newBalance = credits - cost;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ credits_balance: newBalance })
        .eq('id', session.user.id);
      
      if (updateError) throw updateError;

      const { error: transError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: session.user.id,
          amount: -cost,
          description: `Geração de arte: ${selectedFormat}`
        });
      
      if (transError) throw transError;

      setCredits(newBalance);
      
      // 5. Save to Database
      const { error: dbError } = await supabase
        .from('generated_arts')
        .insert({
          user_id: session.user.id,
          image_url: imageUrl,
          caption: caption,
          format: selectedFormat,
          prompt: prompt,
          cost: cost
        });

      if (dbError) {
        console.error('Error saving to DB:', dbError);
      }

      // 6. Save Chat Messages to DB
      await supabase.from('chat_messages').insert([
        { user_id: session.user.id, role: 'user', content: prompt },
        { user_id: session.user.id, role: 'assistant', content: caption, image_url: imageUrl }
      ]);

      // Only show popup if it's an image generation
      if (!isTextOnly) {
        setLastResult({ imageUrl, caption });
      } else {
        setLastResult(null);
        showToast('Conteúdo gerado com sucesso!');
      }

      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: caption,
        imageUrl,
        timestamp: Date.now()
      }]);

    } catch (error: any) {
      console.error('Generation error:', error);
      showToast(error.message || 'Erro ao gerar conteúdo', 'error');
    } finally {
      setIsGenerating(false);
      setEditingImage(null);
    }
  };

  const handleGenerateCaption = async () => {
    if (!lastResult?.imageUrl || isGenerating) return;
    if (credits < 2) {
      showToast('Créditos insuficientes para gerar legenda (Necessário: 2)', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      // Fetch image and convert to base64
      const imageResponse = await fetch(lastResult.imageUrl);
      const imageBlob = await imageResponse.blob();
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(imageBlob);
      });

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: base64Data
                }
              },
              { text: `Gere uma legenda estratégica e criativa em Português Brasileiro para este post. 
Identidade da marca: ${brand.brand_personality || brand.personality}, Tom: ${brand.tone_of_voice}. 
Contexto do post: ${userInput || 'Imagem gerada pela IARA'}.
Inclua hashtags relevantes.` }
            ]
          }
        ]
      });

      const caption = response.text || '';

      // Deduct credits
      const newBalance = credits - 2;
      await supabase.from('profiles').update({ credits_balance: newBalance }).eq('id', session.user.id);
      await supabase.from('credit_transactions').insert({
        user_id: session.user.id,
        amount: -2,
        description: 'Geração de legenda avulsa'
      });

      setCredits(newBalance);
      setLastResult(prev => prev ? { ...prev, caption } : null);
      showToast('Legenda gerada com sucesso! (-2 créditos)');
    } catch (error: any) {
      showToast('Erro ao gerar legenda: ' + error.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveBrand = async () => {
    try {
      const { error } = await supabase
        .from('brand_settings')
        .upsert({
          id: session.user.id,
          ...brand,
          brand_personality: brand.personality, // Keep in sync
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      showToast('Marca salva com sucesso! ✓');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const handleFileUpload = async (type: 'logo' | 'ref', index?: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const timestamp = Date.now();
        const path = type === 'logo' 
          ? `${session.user.id}/logo-${timestamp}` 
          : `${session.user.id}/ref-${index}-${timestamp}`;
        
        const { error: uploadError } = await supabase.storage
          .from('brand-assets')
          .upload(path, file, { upsert: true });
        
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('brand-assets')
          .getPublicUrl(path);

        if (type === 'logo') {
          setBrand(prev => ({ ...prev, logo_url: publicUrl }));
          setScheduleForm(prev => ({ ...prev, image_url: publicUrl }));
        } else {
          const refs = JSON.parse(brand.reference_images || '[]');
          refs[index!] = publicUrl;
          setBrand(prev => ({ ...prev, reference_images: JSON.stringify(refs) }));
        }
      } catch (error: any) {
        showToast(error.message, 'error');
      }
    };
    input.click();
  };

  const handleDeleteFile = async (type: 'logo' | 'ref', index?: number) => {
    if (type === 'logo') {
      setBrand(prev => ({ ...prev, logo_url: '' }));
    } else {
      try {
        const refs = JSON.parse(brand.reference_images || '[]');
        refs[index!] = null;
        setBrand(prev => ({ ...prev, reference_images: JSON.stringify(refs) }));
      } catch (e) {
        setBrand(prev => ({ ...prev, reference_images: '[]' }));
      }
    }
  };

  const loadHistory = async (page = 0) => {
    if (!session?.user) return;
    try {
      const { data, error } = await supabase
        .from('generated_arts')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .range(page * 12, (page + 1) * 12 - 1);
      
      if (error) throw error;

      const itemsWithUrls = data.map(item => ({
        ...item,
        url: item.image_url
      }));

      if (page === 0) {
        setHistoryItems(itemsWithUrls);
      } else {
        setHistoryItems(prev => [...prev, ...itemsWithUrls]);
      }
      
      setHasMoreHistory(data.length === 12);
      setHistoryPage(page);
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'historico' && session) {
      loadHistory(0);
    }
  }, [activeTab, session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-brand" size={48} />
          <p className="text-white/40 text-sm animate-pulse">Iniciando ambiente...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full glass p-10 rounded-[40px] shadow-2xl space-y-8"
        >
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-brand/10 rounded-3xl flex items-center justify-center mx-auto text-brand animate-pulse-neon">
              <Sparkles size={40} />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              Confirme para entrar
            </h2>
            <p className="text-white/40 text-sm">
              Seus créditos estão prontos! Acesse com mesmo login e senha de sua conta.
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-4">E-mail</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-brand/50 transition-all"
                placeholder="seu@email.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-4">Senha</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 pr-14 text-sm focus:outline-none focus:border-brand/50 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/20 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full btn-gradient text-white font-black py-5 rounded-2xl shadow-xl shadow-brand/20 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-sm"
            >
              Entrar
            </button>
          </form>

          <div className="text-center">
            <a 
              href="https://app.monarcahub.com/"
              className="text-xs font-bold text-white/40 hover:text-brand transition-colors uppercase tracking-widest"
            >
              Voltar para o Início
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white font-sans selection:bg-brand/30 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 bg-[#111827] border-r border-white/5 flex-col sticky top-0 h-screen z-[60]">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <img 
              src="https://app.monarcahub.com/logo-iara.png" 
              alt="IARA Logo" 
              className="h-10 w-auto"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/iara/200/80';
              }}
            />
          </div>

          <nav className="space-y-2">
            {[
              { label: 'Visão Geral', icon: <LayoutGrid size={20} />, href: 'https://app.monarcahub.com/' },
              { label: 'Treinar IA', icon: <Cpu size={20} />, href: 'https://app.monarcahub.com/treinar-ia' },
              { label: 'Conexões', icon: <Smartphone size={20} />, href: 'https://app.monarcahub.com/conexoes' },
              { label: 'MídIAs', icon: <ImageIcon size={20} />, href: '/', active: true },
              { label: 'Assinatura', icon: <CreditCard size={20} />, href: 'https://app.monarcahub.com/assinatura' },
              { label: 'Minha Conta', icon: <User size={20} />, href: 'https://app.monarcahub.com/minha-conta' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={cn(
                  "flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-bold transition-all duration-300",
                  link.active 
                    ? "bg-white/5 text-brand shadow-[inset_0_0_20px_rgba(234,88,12,0.05)] border border-brand/20" 
                    : "text-white/40 hover:text-white hover:bg-white/5"
                )}
              >
                <div className={cn(
                  "transition-colors duration-300",
                  link.active ? "text-brand" : "text-white/40"
                )}>
                  {link.icon}
                </div>
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-white/5 space-y-6">
          <div className="text-center">
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">Desenvolvido por</p>
            <p className="text-xs font-black text-brand uppercase tracking-wider">Monarca Hub</p>
          </div>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold text-white/40 hover:text-red-500 hover:bg-red-500/10 transition-all group"
          >
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto p-4 md:p-8">
          {/* Left Column: Main Interface */}
          <div className="space-y-6 md:space-y-8">
            {/* Navigation Tabs Bar */}
            <div className="glass rounded-[24px] md:rounded-[32px] p-2 flex items-center justify-between md:justify-start gap-2 shadow-[0_0_30px_rgba(0,0,0,0.5)] relative z-50">
              <div className="flex items-center gap-3 px-4 md:px-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-brand/10 rounded-xl md:rounded-2xl flex items-center justify-center text-brand animate-pulse-neon">
                  <Sparkles size={20} className="md:hidden" />
                  <Sparkles size={24} className="hidden md:block" />
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-bold tracking-tight">Geração Criativa</h3>
                  <p className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-widest font-medium">AI Powered Engine</p>
                </div>
                
                {/* Mobile Credits Badge */}
                <div className="md:hidden relative">
                  <button 
                    onClick={() => setShowCreditsTooltip(!showCreditsTooltip)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 rounded-full border border-brand/20"
                  >
                    <Zap size={10} className="text-brand" />
                    <span className="text-[9px] font-black text-brand">{credits}</span>
                    <Plus size={10} className="text-brand ml-0.5" />
                  </button>

                  <AnimatePresence>
                    {showCreditsTooltip && (
                      <>
                        <div className="fixed inset-0 z-[70]" onClick={() => setShowCreditsTooltip(false)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 10 }}
                          className="absolute right-0 top-full mt-2 w-64 bg-[#111827] border border-white/10 rounded-2xl shadow-2xl p-4 z-[80] backdrop-blur-xl"
                        >
                          <p className="text-[11px] text-white/80 leading-relaxed mb-3">
                            Adicionar créditos agora? Faça login e acesse a aba "Assinatura".
                          </p>
                          <a 
                            href="https://app.monarcahub.com/assinatura"
                            className="flex items-center justify-center w-full py-2 bg-brand text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-light transition-all"
                          >
                            Carregar
                          </a>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
                
                {/* Desktop Credits */}
                <div className="hidden lg:flex relative">
                  <button 
                    onClick={() => setShowCreditsTooltip(!showCreditsTooltip)}
                    className="flex items-center gap-3 ml-6 px-4 py-2 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group"
                  >
                    <Zap size={14} className="text-brand" />
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Créditos:</span>
                    <span className="text-xs font-black text-brand">{credits}</span>
                    <div className="w-5 h-5 rounded-lg bg-brand/10 flex items-center justify-center text-brand group-hover:bg-brand group-hover:text-white transition-all">
                      <Plus size={12} />
                    </div>
                  </button>

                  <AnimatePresence>
                    {showCreditsTooltip && (
                      <>
                        <div className="fixed inset-0 z-[70]" onClick={() => setShowCreditsTooltip(false)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute left-6 top-full mt-2 w-64 bg-[#111827] border border-white/10 rounded-2xl shadow-2xl p-4 z-[80] backdrop-blur-xl"
                        >
                          <p className="text-[11px] text-white/80 leading-relaxed mb-3">
                            Adicionar créditos agora? Faça login e acesse a aba "Assinatura".
                          </p>
                          <a 
                            href="https://app.monarcahub.com/assinatura"
                            className="flex items-center justify-center w-full py-2 bg-brand text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-light transition-all"
                          >
                            Carregar
                          </a>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden md:flex flex-1 items-center justify-end gap-2">
                <div className="flex items-center gap-2 p-1.5 bg-black/40 rounded-[24px] border border-white/5">
                  <button 
                    onClick={() => setActiveTab('geracao')}
                    className={cn(
                      "px-8 py-3 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center gap-2",
                      activeTab === 'geracao' ? "btn-gradient text-white shadow-[0_0_20px_rgba(234,88,12,0.4)] scale-105" : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Zap size={16} />
                    Gerar
                  </button>
                  <button 
                    onClick={() => setActiveTab('agendamento')}
                    className={cn(
                      "px-8 py-3 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center gap-2",
                      activeTab === 'agendamento' ? "btn-gradient text-white shadow-[0_0_20px_rgba(234,88,12,0.4)] scale-105" : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Calendar size={16} />
                    Postar / Agendar
                  </button>
                </div>

                <div className="relative ml-2">
                  <button 
                    onClick={() => setIsDesktopMenuOpen(!isDesktopMenuOpen)}
                    className={cn(
                      "w-12 h-12 flex items-center justify-center rounded-2xl transition-all group",
                      isDesktopMenuOpen ? "bg-brand/10 text-brand" : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <MoreVertical size={20} />
                  </button>

                  <AnimatePresence>
                    {isDesktopMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsDesktopMenuOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute right-0 mt-2 w-56 bg-[#111827] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 backdrop-blur-xl"
                        >
                          <button 
                            onClick={() => { setActiveTab('marca'); setIsDesktopMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all"
                          >
                            <Palette size={16} />
                            Marca
                          </button>
                          <button 
                            onClick={() => { setActiveTab('historico'); setIsDesktopMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all"
                          >
                            <History size={16} />
                            Histórico
                          </button>
                          <div className="h-px bg-white/5 my-2" />
                          <button 
                            onClick={() => {
                              setChatMessages([{ role: 'assistant', content: 'Me diga o que você quer criar e eu gero a arte + legenda no seu estilo. Você só precisa configurar sua marca uma vez na aba "Marca".', timestamp: Date.now() }]);
                              setLastResult(null);
                              setIsDesktopMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-white/60 hover:text-brand hover:bg-brand/10 transition-all"
                          >
                            <RefreshCw size={16} />
                            Resetar
                          </button>
                          <button 
                            onClick={() => { handleLogout(); setIsDesktopMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-white/60 hover:text-red-500 hover:bg-red-500/10 transition-all"
                          >
                            <LogOut size={16} />
                            Sair
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Mobile Menu Toggle */}
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden w-10 h-10 flex items-center justify-center text-white/60 hover:text-white bg-white/5 rounded-xl transition-all mr-2"
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              {/* Mobile Menu Overlay */}
              <AnimatePresence>
                {isMobileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-full left-0 right-0 mt-2 p-4 bg-[#111827] backdrop-blur-2xl rounded-[24px] shadow-2xl md:hidden flex flex-col gap-2 z-50 border border-white/10"
                  >
                    <div className="px-6 py-4 mb-2 bg-brand/10 rounded-xl border border-brand/20 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Zap size={18} className="text-brand" />
                        <span className="text-xs font-bold uppercase tracking-widest text-white/60">Seus Créditos</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-brand">{credits}</span>
                        <a 
                          href="https://app.monarcahub.com/assinatura"
                          className="w-6 h-6 rounded-lg bg-brand flex items-center justify-center text-white shadow-lg shadow-brand/20"
                        >
                          <Plus size={14} />
                        </a>
                      </div>
                    </div>

                    {/* App Navigation */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <button 
                        onClick={() => { setActiveTab('geracao'); setIsMobileMenuOpen(false); }}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-xl text-[10px] font-bold transition-all",
                          activeTab === 'geracao' ? "bg-brand text-white" : "bg-white/5 text-white/60"
                        )}
                      >
                        <Zap size={18} />
                        Gerar
                      </button>
                      <button 
                        onClick={() => { setActiveTab('marca'); setIsMobileMenuOpen(false); }}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-xl text-[10px] font-bold transition-all",
                          activeTab === 'marca' ? "bg-brand text-white" : "bg-white/5 text-white/60"
                        )}
                      >
                        <Palette size={18} />
                        Marca
                      </button>
                      <button 
                        onClick={() => { setActiveTab('historico'); setIsMobileMenuOpen(false); }}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-xl text-[10px] font-bold transition-all",
                          activeTab === 'historico' ? "bg-brand text-white" : "bg-white/5 text-white/60"
                        )}
                      >
                        <History size={18} />
                        Histórico
                      </button>
                    </div>

                    <button 
                      onClick={() => { setActiveTab('agendamento'); setIsMobileMenuOpen(false); }}
                      className={cn(
                        "flex items-center justify-center gap-3 p-4 rounded-xl text-xs font-bold transition-all mb-4",
                        activeTab === 'agendamento' ? "bg-brand text-white" : "bg-white/5 text-white/60"
                      )}
                    >
                      <Calendar size={18} />
                      Postar / Agendar
                    </button>

                    <div className="h-px bg-white/10 my-2" />

                    {/* Sidebar Links in Mobile */}
                    <div className="space-y-1">
                      {[
                        { label: 'Visão Geral', icon: <LayoutGrid size={18} />, href: 'https://app.monarcahub.com/' },
                        { label: 'Treinar IA', icon: <Cpu size={18} />, href: 'https://app.monarcahub.com/treinar-ia' },
                        { label: 'Conexões', icon: <Smartphone size={18} />, href: 'https://app.monarcahub.com/conexoes' },
                        { label: 'Assinatura', icon: <CreditCard size={18} />, href: 'https://app.monarcahub.com/assinatura' },
                        { label: 'Minha Conta', icon: <User size={18} />, href: 'https://app.monarcahub.com/minha-conta' },
                      ].map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          className="flex items-center gap-4 px-6 py-4 rounded-xl text-sm font-bold text-white/40 hover:text-white hover:bg-white/5 transition-all"
                        >
                          {link.icon}
                          {link.label}
                        </a>
                      ))}
                    </div>
                    
                    <div className="h-px bg-white/10 my-2" />
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setChatMessages([{ role: 'assistant', content: 'Me diga o que você quer criar e eu gero a arte + legenda no seu estilo. Você só precisa configurar sua marca uma vez na aba "Marca".', timestamp: Date.now() }]);
                          setLastResult(null);
                          setIsMobileMenuOpen(false);
                        }}
                        className="flex-1 px-6 py-4 bg-white/5 rounded-xl text-sm font-bold text-white/60 flex items-center justify-center gap-3"
                      >
                        <RefreshCw size={18} />
                        Resetar
                      </button>
                      <button 
                        onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                        className="flex-1 px-6 py-4 bg-red-500/10 rounded-xl text-sm font-bold text-red-500 flex items-center justify-center gap-3"
                      >
                        <LogOut size={18} />
                        Sair
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          {/* Tab Content Area */}
          <div className="glass rounded-[32px] md:rounded-[48px] overflow-hidden min-h-[500px] md:min-h-[650px] flex flex-col shadow-2xl relative">
            {/* Loading Overlay */}
            <AnimatePresence>
              {isGenerating && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-[#030712]/80 backdrop-blur-md flex flex-col items-center justify-center p-12 text-center"
                >
                  <div className="relative">
                    <div className="w-24 h-24 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
                    <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-brand animate-pulse" size={32} />
                  </div>
                  <div className="mt-8 space-y-2">
                    <h3 className="text-xl font-bold tracking-tight">IARA está criando...</h3>
                    <p className="text-sm text-white/40 max-w-[280px] mx-auto leading-relaxed">
                      {selectedFormat === 'texto' 
                        ? "Consultando estratégias e refinando sua cópia..." 
                        : "Renderizando sua arte em alta definição (1K)..."}
                    </p>
                  </div>
                  <div className="mt-12 flex gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.div 
                        key={i}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                        className="w-2 h-2 bg-brand rounded-full"
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-transparent pointer-events-none" />
            <ImageSelectionModal 
        isOpen={isSelectionModalOpen}
        onClose={() => setIsSelectionModalOpen(false)}
        candidates={searchCandidates}
        isSearching={isSearchingCandidates}
        setSearchCandidates={setSearchCandidates}
        setIsSearchingCandidates={setIsSearchingCandidates}
        handleAISearchFallback={handleAISearchFallback}
        showToast={showToast}
        onSelectLogo={(url) => {
          const proxiedUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
          setBrand(prev => ({ ...prev, logo_url: proxiedUrl }));
          setScheduleForm(prev => ({ ...prev, image_url: proxiedUrl }));
          extractColorsFromLogo(url);
          showToast('Logo selecionado!', 'success');
        }}
        onAddReference={(url) => {
          const proxiedUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
          setBrand(prev => {
            const currentRefs = JSON.parse(prev.reference_images || '[]');
            if (currentRefs.includes(proxiedUrl)) return prev;
            const newRefs = [...currentRefs, proxiedUrl].slice(0, 6);
            return { ...prev, reference_images: JSON.stringify(newRefs) };
          });
          showToast('Referência adicionada!', 'success');
        }}
      />

      <AnimatePresence mode="wait">
              {activeTab === 'geracao' && (
                <motion.div 
                  key="geracao"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  className="flex flex-col h-full relative z-10"
                >
                  {/* Format Selector Section */}
                  <div className="p-6 md:p-10 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-3 mb-6 md:mb-8">
                      <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
                      <h4 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-white/40">Selecione o Formato</h4>
                    </div>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                      {[
                        { id: 'texto', label: 'Texto IA', icon: <Type size={18} /> },
                        { id: 'quadrado', label: 'Quadrado', icon: <Square size={18} /> },
                        { id: 'retrato', label: 'Retrato (4:5)', icon: <Smartphone size={18} /> },
                        { id: 'story', label: 'Story (9:16)', icon: <Smartphone size={18} /> },
                      ].map((format) => (
                        <button
                          key={format.id}
                          onClick={() => setSelectedFormat(format.id as any)}
                          className={cn(
                            "group flex items-center gap-3 md:gap-4 px-4 md:px-8 py-4 md:py-5 rounded-[20px] md:rounded-[24px] border transition-all duration-500 font-bold text-xs md:text-sm relative overflow-hidden",
                            selectedFormat === format.id 
                              ? "bg-brand/10 border-brand text-white shadow-[0_0_30px_rgba(234,88,12,0.2)]" 
                              : "bg-white/5 border-white/5 text-white/40 hover:border-white/20 hover:text-white hover:bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "transition-transform duration-500 group-hover:scale-110",
                            selectedFormat === format.id ? "text-brand" : "text-white/40"
                          )}>
                            {format.icon}
                          </div>
                          <span className="truncate">{format.label}</span>
                          {selectedFormat === format.id && (
                            <motion.div 
                              layoutId="format-glow"
                              className="absolute inset-0 bg-brand/5 blur-xl"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 md:mt-6 flex flex-col md:flex-row md:items-center gap-4">
                      <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                        Consumo: {selectedFormat === 'texto' ? '2' : '10'} Créditos
                      </p>
                      <div className="hidden md:block h-px flex-1 bg-white/5" />
                      <p className="text-[10px] font-bold text-brand/60 uppercase tracking-widest">
                        {brand.logo_url ? 'Logo Ativa ✓' : 'Sem Logo'} • {JSON.parse(brand.reference_images || '[]').filter(Boolean).length}/3 Referências
                      </p>
                    </div>
                  </div>

                  {/* Chat Area */}
                  <div className="flex-1 flex flex-col min-h-[450px]">
                    <div className="px-10 py-6 border-b border-white/5 bg-black/40 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-brand neon-border">
                          <Sparkles size={24} />
                        </div>
                        <div>
                          <h4 className="text-base font-bold tracking-tight">Assistente Criativo</h4>
                          <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Conversational AI Interface</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest">Online</span>
                      </div>
                    </div>

                    <div className="flex-1 p-10 overflow-y-auto space-y-8 max-h-[550px] scrollbar-hide">
                      {chatMessages.map((msg, i) => (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={i} 
                          className={cn(
                            "flex flex-col max-w-[85%]",
                            msg.role === 'user' ? "ml-auto items-end" : "items-start"
                          )}
                        >
                          <div className={cn(
                            "px-8 py-5 rounded-[32px] text-sm leading-relaxed shadow-xl",
                            msg.role === 'user' 
                              ? "bg-brand text-white rounded-tr-none shadow-brand/10" 
                              : "glass text-white/90 rounded-tl-none border-white/10"
                          )}>
                            <div className="markdown-body">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                            {msg.imageUrl && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="mt-6 rounded-[24px] overflow-hidden border border-white/10 shadow-2xl group relative"
                              >
                                <img src={msg.imageUrl} alt="Generated" className="max-w-full h-auto transition-transform duration-700 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                                  <p className="text-[10px] font-bold text-white uppercase tracking-widest">Preview Gerado</p>
                                </div>
                              </motion.div>
                            )}
                          </div>
                          <span className="text-[9px] font-bold text-white/20 mt-2 uppercase tracking-widest px-2">
                            {msg.role === 'user' ? 'Você' : 'AI Assistant'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </motion.div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-6 md:p-10 bg-black/40 border-t border-white/5">
                      <AnimatePresence>
                        {editingImage && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-4 md:mb-6 relative group"
                          >
                            <div className="flex flex-col gap-3 p-4 glass rounded-2xl md:rounded-3xl border-orange-500/30 bg-orange-500/5">
                              <div className="flex items-center gap-3 md:gap-4">
                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg md:rounded-xl overflow-hidden border border-white/10">
                                  <img src={editingImage} alt="Edit target" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-[9px] md:text-[10px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                                      Instabilidade Detectada
                                    </p>
                                  </div>
                                  <p className="text-[10px] md:text-xs text-white/80 font-medium">A edição direta pode apresentar falhas no momento.</p>
                                </div>
                                <button 
                                  onClick={() => setEditingImage(null)}
                                  className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"
                                >
                                  <Plus size={18} className="rotate-45" />
                                </button>
                              </div>
                              
                              <div className="pt-3 border-t border-white/5 space-y-2">
                                <p className="text-[10px] text-white/60 leading-relaxed">
                                  <strong className="text-white">Dica para melhores resultados:</strong> Remova as imagens em referência de estilo e solicite no chat para editar a imagem de referência.
                                </p>
                                <div className="p-3 bg-brand/10 rounded-xl border border-brand/20">
                                  <p className="text-[10px] text-brand-light leading-relaxed mb-2">
                                    <strong>Precisa de perfeição?</strong> Contrate um de nossos designers para melhorar a arte pra você. O custo é de apenas <span className="font-bold text-white">R$ 27 por arte</span>.
                                  </p>
                                  <a 
                                    href="https://wa.me/5555996079863?text=Quero%20editar%20uma%20imagem%20e%20pagar%20apenas%20R%2427.%20"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-[10px] font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors"
                                  >
                                    <MessageCircle size={12} />
                                    Contratar via WhatsApp
                                  </a>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-brand/20 to-orange-400/20 rounded-[30px] md:rounded-[40px] blur opacity-0 group-focus-within:opacity-100 transition duration-1000" />
                        <textarea
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          placeholder="Descreva sua ideia..."
                          className="relative w-full bg-black/60 border border-white/10 rounded-[24px] md:rounded-[36px] px-6 md:px-10 py-6 md:py-8 pr-20 md:pr-24 text-xs md:text-sm focus:outline-none focus:border-brand/50 transition-all resize-none h-24 md:h-28 shadow-2xl placeholder:text-white/20"
                        />
                        <button 
                          onClick={handleSendMessage}
                          disabled={isGenerating || !userInput.trim()}
                          className="absolute right-4 md:right-6 bottom-4 md:bottom-6 w-12 h-12 md:w-16 md:h-16 btn-gradient text-white rounded-full flex items-center justify-center shadow-2xl shadow-brand/30 hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 group"
                        >
                          {isGenerating ? <Loader2 size={20} className="animate-spin md:hidden" /> : <Send size={20} className="md:hidden group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                          {isGenerating ? <Loader2 size={24} className="animate-spin hidden md:block" /> : <Send size={24} className="hidden md:block group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'marca' && (
                <motion.div 
                  key="marca"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="p-12 space-y-12 relative z-10"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">DNA da Marca</h2>
                      <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-bold">Configure a identidade visual e verbal</p>
                    </div>
                    <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-brand neon-border">
                      <Palette size={24} />
                    </div>
                  </div>

                  {/* Instagram Import Box */}
                  <div className="glass rounded-[24px] p-4 border border-white/5 relative group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888] rounded-lg flex items-center justify-center text-white shadow-lg shadow-brand/20">
                        <Instagram size={20} />
                      </div>
                      <div className="flex-1 space-y-0.5 text-center md:text-left">
                        <h3 className="text-sm font-bold tracking-tight">Importar do Instagram</h3>
                        <div className="flex flex-col gap-1">
                          <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Puxe logo e referências automaticamente</p>
                          <div className="relative group/tooltip inline-block">
                            <div 
                              className="flex items-center justify-center md:justify-start gap-2 text-[11px] text-orange-400 font-bold cursor-help bg-orange-400/10 px-2 py-0.5 rounded-full"
                              onClick={(e) => {
                                const tooltip = e.currentTarget.nextElementSibling;
                                if (tooltip) tooltip.classList.toggle('visible');
                                if (tooltip) tooltip.classList.toggle('opacity-100');
                              }}
                            >
                              <HelpCircle size={14} />
                              <span>Beta</span>
                            </div>
                            <div className="absolute bottom-full left-0 md:left-0 mb-3 w-72 p-4 bg-black/95 border border-white/10 rounded-2xl text-xs text-white/90 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-[100] shadow-2xl backdrop-blur-2xl pointer-events-none ring-1 ring-white/20">
                              <div className="font-bold text-orange-400 mb-1 flex items-center gap-2">
                                <Sparkles size={12} />
                                Busca Inteligente (Beta)
                              </div>
                              Essa opção utiliza inteligência artificial para buscar dados na web quando o Instagram bloqueia o acesso. Pode demorar alguns segundos e os links podem expirar.
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3">
                        <div className="relative w-full sm:w-56">
                          <input 
                            type="text"
                            placeholder="@seu.instagram"
                            value={instaHandle}
                            onChange={(e) => setInstaHandle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleImportInstagram()}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:border-brand/50 transition-all placeholder:text-white/20"
                          />
                        </div>
                        <button 
                          onClick={handleImportInstagram}
                          disabled={isImportingInsta}
                          className="w-full sm:w-auto px-6 py-2.5 btn-gradient text-white rounded-xl text-xs font-bold shadow-lg shadow-brand/20 hover:scale-105 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                        >
                          {isImportingInsta ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <RefreshCw size={14} />
                          )}
                          {isImportingInsta ? 'Importando...' : 'Importar'}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <section className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-brand rounded-full" />
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Identidade Visual</label>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Logo Master</p>
                          <button 
                            onClick={() => handleFileUpload('logo')}
                            className="w-full aspect-video glass rounded-[24px] flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition-all overflow-hidden group relative"
                          >
                            {brand.logo_url ? (
                              <img 
                                src={brand.logo_url} 
                                className="w-full h-full object-contain p-6 transition-transform duration-500 group-hover:scale-110" 
                                alt="Logo" 
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  if (target.src.includes('/api/proxy-image?url=')) {
                                    const originalUrl = decodeURIComponent(target.src.split('url=')[1]);
                                    target.src = originalUrl;
                                  }
                                }}
                              />
                            ) : (
                              <>
                                <Upload size={24} className="text-white/20 group-hover:text-brand transition-colors" />
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Upload PNG</span>
                              </>
                            )}
                          </button>
                          <a 
                            href="https://agencia.monarcahub.com/construcao-de-logo-identidade-visual/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 py-3 w-full glass rounded-[18px] text-[10px] font-bold text-brand uppercase tracking-widest hover:bg-brand/10 transition-all border border-brand/20 mt-2"
                          >
                            <Sparkles size={12} />
                            Criar nova logo
                          </a>
                        </div>
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Paleta de Cores</p>
                          <div className="flex flex-wrap gap-3">
                            {(Array.isArray(brand.colors) ? brand.colors : []).map((c, i) => (
                              <div key={i} className="group relative">
                                <input 
                                  type="color"
                                  value={c}
                                  onChange={(e) => {
                                    const newColors = [...(Array.isArray(brand.colors) ? brand.colors : [])];
                                    newColors[i] = e.target.value;
                                    setBrand(prev => ({ ...prev, colors: newColors }));
                                  }}
                                  className="w-10 h-10 rounded-xl border border-white/10 cursor-pointer bg-transparent overflow-hidden"
                                />
                                <button 
                                  onClick={() => {
                                    const newColors = (Array.isArray(brand.colors) ? brand.colors : []).filter((_, idx) => idx !== i);
                                    setBrand(prev => ({ ...prev, colors: newColors }));
                                  }}
                                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {(Array.isArray(brand.colors) ? brand.colors : []).length < 6 && (
                              <button 
                                onClick={() => {
                                  const newColors = [...(Array.isArray(brand.colors) ? brand.colors : []), '#ffffff'];
                                  setBrand(prev => ({ ...prev, colors: newColors }));
                                }}
                                className="w-10 h-10 rounded-xl border border-dashed border-white/20 flex items-center justify-center text-white/20 hover:text-brand hover:border-brand/50 transition-all"
                              >
                                <Plus size={16} />
                              </button>
                            )}
                          </div>
                          <p className="text-[9px] text-white/20 uppercase font-bold tracking-widest">Clique na cor para alterar ou no + para adicionar</p>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 bg-brand rounded-full" />
                          <label className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Referências de estilo</label>
                        </div>
                        <div className="group relative">
                          <HelpCircle size={14} className="text-white/20 cursor-help" />
                          <div className="absolute right-0 bottom-full mb-2 w-48 p-3 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl text-[10px] text-white/60 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            Sempre que você quiser usar a imagem de um personagem ou padrão visual, pode inserir aqui as imagens de referência.
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        {[0, 1, 2].map(i => {
                          const refs = JSON.parse(brand.reference_images || '[]');
                          const imageUrl = refs[i];
                          
                          return (
                            <div key={i} className="relative group">
                              <button 
                                onClick={() => !imageUrl && handleFileUpload('ref', i)}
                                className={cn(
                                  "aspect-square w-full glass rounded-[24px] flex items-center justify-center transition-all overflow-hidden relative",
                                  !imageUrl && "hover:bg-white/10"
                                )}
                              >
                                {imageUrl ? (
                                  <img 
                                    src={imageUrl} 
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                    alt="Ref" 
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      if (target.src.includes('/api/proxy-image?url=')) {
                                        const originalUrl = decodeURIComponent(target.src.split('url=')[1]);
                                        target.src = originalUrl;
                                      }
                                    }}
                                  />
                                ) : (
                                  <Plus size={24} className="text-white/20 group-hover:text-brand transition-colors" />
                                )}
                              </button>
                              
                              {imageUrl && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFile('ref', i);
                                  }}
                                  className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-20 hover:bg-red-600"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <section className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-brand rounded-full" />
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Tom de Voz</label>
                      </div>
                      <div className="space-y-4">
                        <div className="relative">
                          <select 
                            value={['Profissional', 'Amigável', 'Motivador', 'Divertido'].includes(brand.tone_of_voice) ? brand.tone_of_voice : 'Personalizado'}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'Personalizado') {
                                setBrand(prev => ({ ...prev, tone_of_voice: customTone || 'Personalizado' }));
                              } else {
                                setBrand(prev => ({ ...prev, tone_of_voice: val }));
                              }
                            }}
                            className="w-full glass rounded-[24px] px-8 py-5 text-sm focus:outline-none focus:border-brand/50 appearance-none cursor-pointer font-bold"
                          >
                            <option value="Profissional" className="bg-[#1a1a1a]">Profissional</option>
                            <option value="Amigável" className="bg-[#1a1a1a]">Amigável</option>
                            <option value="Motivador" className="bg-[#1a1a1a]">Motivador</option>
                            <option value="Divertido" className="bg-[#1a1a1a]">Divertido</option>
                            <option value="Personalizado" className="bg-[#1a1a1a]">Personalizado</option>
                          </select>
                          <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                            <ChevronRight size={16} className="rotate-90" />
                          </div>
                        </div>

                        <AnimatePresence>
                          {(!['Profissional', 'Amigável', 'Motivador', 'Divertido'].includes(brand.tone_of_voice) || brand.tone_of_voice === 'Personalizado') && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="relative">
                                <input 
                                  type="text"
                                  maxLength={15}
                                  placeholder="Defina seu tom (ex: Rebelde)"
                                  value={brand.tone_of_voice === 'Personalizado' ? customTone : brand.tone_of_voice}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomTone(val);
                                    setBrand(prev => ({ ...prev, tone_of_voice: val }));
                                  }}
                                  className="w-full glass rounded-[20px] px-6 py-4 text-sm focus:outline-none focus:border-brand/50 transition-all font-bold placeholder:text-white/20"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/20 uppercase">
                                  {brand.tone_of_voice.length}/15
                                </span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </section>

                    <section className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-brand rounded-full" />
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Personalidade da Marca</label>
                      </div>
                      <textarea 
                        placeholder="Descreva a alma da sua marca... (ex: Inovadora, disruptiva e focada em tecnologia de ponta)"
                        value={brand.personality}
                        onChange={(e) => setBrand(prev => ({ ...prev, personality: e.target.value }))}
                        className="w-full glass rounded-[24px] px-8 py-6 text-sm focus:outline-none focus:border-brand/50 h-36 resize-none shadow-inner placeholder:text-white/20"
                      />
                    </section>
                  </div>

                  <button 
                    onClick={handleSaveBrand}
                    className="w-full btn-gradient text-white font-black py-6 rounded-[28px] shadow-2xl shadow-brand/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-sm"
                  >
                    <Check size={20} />
                    Consolidar DNA da Marca
                  </button>
                </motion.div>
              )}

              {activeTab === 'agendamento' && (
                <motion.div 
                  key="agendamento"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="p-12 space-y-10 relative z-10"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Postar / Agendar</h2>
                      <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-bold">Gerencie suas publicações nas redes sociais</p>
                    </div>
                    <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-brand neon-border">
                      <Calendar size={24} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="glass rounded-[32px] p-8 border border-white/5 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-brand rounded-full" />
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Nova Publicação</label>
                      </div>
                      
                      <div className="space-y-4">
                        <div 
                          onClick={() => handleFileUpload('logo')} // Reusing logo upload for simplicity or create a specific one
                          className="aspect-video glass rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 hover:bg-white/5 transition-all cursor-pointer group overflow-hidden"
                        >
                          {scheduleForm.image_url ? (
                            <img src={scheduleForm.image_url} className="w-full h-full object-cover" alt="To Schedule" />
                          ) : (
                            <>
                              <Upload size={24} className="text-white/20 group-hover:text-brand transition-colors" />
                              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Clique para upload da imagem</p>
                            </>
                          )}
                        </div>
                        
                        <textarea 
                          placeholder="Escreva sua legenda aqui..."
                          value={scheduleForm.caption}
                          onChange={(e) => setScheduleForm(prev => ({ ...prev, caption: e.target.value }))}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-brand/50 h-32 resize-none transition-all placeholder:text-white/20"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-2">Data</label>
                          <input 
                            type="date" 
                            value={scheduleForm.date}
                            onChange={(e) => setScheduleForm(prev => ({ ...prev, date: e.target.value }))}
                            className="w-full glass rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-brand/50" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-2">Hora</label>
                          <input 
                            type="time" 
                            value={scheduleForm.time}
                            onChange={(e) => setScheduleForm(prev => ({ ...prev, time: e.target.value }))}
                            className="w-full glass rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-brand/50" 
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <button 
                          onClick={handleSchedulePost}
                          disabled={isScheduling}
                          className="w-full btn-gradient text-white font-black py-4 rounded-2xl shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs disabled:opacity-50"
                        >
                          {isScheduling ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
                          {isScheduling ? 'Agendando...' : 'Agendar Postagem'}
                        </button>
                        <p className="text-center text-[10px] font-bold text-white/20 uppercase tracking-widest">
                          Consumo: 20 Créditos por agendamento
                        </p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-brand rounded-full" />
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Próximos Agendamentos</label>
                      </div>

                      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {scheduledPosts.length === 0 ? (
                          <div className="py-12 text-center glass rounded-[32px] border border-dashed border-white/5">
                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Nenhum post agendado</p>
                          </div>
                        ) : (
                          scheduledPosts.map((post) => (
                            <div key={post.id} className="glass rounded-2xl p-4 border border-white/5 flex items-center gap-4 group">
                              <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
                                <img src={post.image_url} className="w-full h-full object-cover" alt="Scheduled" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white/80 truncate">{post.caption}</p>
                                <p className="text-[10px] text-brand font-bold mt-1 uppercase tracking-widest">
                                  {new Date(post.scheduled_date + 'T' + post.scheduled_time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <button 
                                onClick={() => deleteScheduledPost(post.id)}
                                className="p-2 hover:bg-red-500/10 rounded-lg text-white/20 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))
                        )}
                        
                        <div className="py-8 text-center glass rounded-[32px] border border-dashed border-white/5">
                          <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Conecte suas redes para automação</p>
                          <p className="text-[10px] text-brand font-bold mt-1 uppercase tracking-widest">Fale com suporte para ativar essa função pra você</p>
                          <a 
                            href="https://wa.me/5555996079863?text=Quero%20ativar%20a%20função%20de%20postagem%20automática%20no%20meu%20Instagram."
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex px-6 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold text-white/60 transition-all"
                          >
                            Conectar Instagram
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'historico' && (
                <motion.div 
                  key="historico"
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-12 space-y-10 relative z-10"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Arquivo de Criações</h2>
                      <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-bold">Histórico completo de gerações</p>
                    </div>
                    <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-brand neon-border">
                      <History size={24} />
                    </div>
                  </div>

                  {historyItems.length === 0 ? (
                    <div className="py-40 text-center space-y-6">
                      <div className="w-24 h-24 glass rounded-full flex items-center justify-center mx-auto animate-float">
                        <ImageIcon className="text-white/10" size={48} />
                      </div>
                      <p className="text-sm font-bold text-white/20 uppercase tracking-[0.3em]">Nenhum registro encontrado</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {historyItems.map((item, i) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          key={i} 
                          className="group glass rounded-2xl border-white/5 p-4 flex items-center gap-6 hover:bg-white/5 transition-all duration-300"
                        >
                          {/* Icon/Preview */}
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 flex-shrink-0 flex items-center justify-center border border-white/10">
                            {item.url ? (
                              <img src={item.url} className="w-full h-full object-cover" alt="Art" />
                            ) : (
                              <Type size={20} className="text-brand" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-[10px] font-black text-brand uppercase tracking-widest">{item.format}</span>
                              <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                                {new Date(item.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-white/60 truncate font-medium">
                              {item.prompt}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                setLastResult({ imageUrl: item.image_url, caption: item.caption });
                                setActiveTab('geracao');
                              }}
                              className="px-4 py-2 glass hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                              Detalhes
                            </button>
                            
                            {item.url && (
                              <>
                                <button 
                                  onClick={() => {
                                    setEditingImage(item.url);
                                    setActiveTab('geracao');
                                    setUserInput('Edite esta imagem: ');
                                    showToast('Modo de edição ativado (Instabilidade detectada)', 'warning');
                                  }}
                                  className="p-2 glass hover:bg-white/10 rounded-xl transition-all text-white/40 hover:text-brand"
                                  title="Editar"
                                >
                                  <Pencil size={14} />
                                </button>
                                <a 
                                  href={item.url} 
                                  download 
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-2 glass hover:bg-white/10 rounded-xl transition-all text-white/40 hover:text-emerald-500"
                                  title="Baixar"
                                >
                                  <Download size={14} />
                                </a>
                              </>
                            )}
                          </div>

                          {/* Cost */}
                          <div className="pl-6 border-l border-white/10 text-right min-w-[100px]">
                            <span className="text-xs font-black text-brand">
                              -{item.cost || (item.format === 'texto' ? 5 : 10)} CRÉDITOS
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                  
                  {hasMoreHistory && historyItems.length > 0 && (
                    <button 
                      onClick={() => loadHistory(historyPage + 1)}
                      className="w-full py-6 glass hover:bg-white/5 rounded-[28px] text-xs font-black uppercase tracking-[0.3em] text-white/40 hover:text-white transition-all border-white/5"
                    >
                      Carregar mais resultados
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>

      {/* Result Overlay (When an image is generated) */}
      <AnimatePresence>
        {lastResult && activeTab === 'geracao' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <div className="max-w-4xl w-full bg-[#141414] rounded-[40px] border border-white/10 overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]">
              <div className="flex-1 bg-black/40 flex items-center justify-center p-8">
                {lastResult.imageUrl ? (
                  <img src={lastResult.imageUrl} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" alt="Result" />
                ) : (
                  <div className="flex flex-col items-center text-white/20">
                    <Type size={80} />
                    <p className="mt-4 font-bold">Legenda Gerada</p>
                  </div>
                )}
              </div>
              <div className="w-full md:w-[400px] p-8 flex flex-col border-l border-white/5">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-white/40">Resultado</h4>
                  <button onClick={() => setLastResult(null)} className="p-2 hover:bg-white/5 rounded-full transition-all">
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto mb-6">
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5 text-sm leading-relaxed text-white/80 markdown-body">
                    <ReactMarkdown>{lastResult.caption}</ReactMarkdown>
                  </div>
                </div>

                <div className="space-y-3">
                  {lastResult.caption ? (
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(lastResult.caption);
                        showToast('Legenda copiada!');
                      }}
                      className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold border border-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <Copy size={16} />
                      Copiar Legenda
                    </button>
                  ) : (
                    <button 
                      onClick={handleGenerateCaption}
                      disabled={isGenerating}
                      className="w-full py-4 bg-brand/10 hover:bg-brand/20 text-brand rounded-2xl text-xs font-bold border border-brand/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                      Gerar Legenda (-2 créditos)
                    </button>
                  )}
                  {lastResult.imageUrl && (
                    <a 
                      href={lastResult.imageUrl} 
                      download 
                      className="w-full py-4 bg-brand text-white rounded-2xl text-xs font-bold shadow-lg shadow-brand/20 hover:bg-brand/90 transition-all flex items-center justify-center gap-2"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download size={16} />
                      Baixar Arte
                    </a>
                  )}
                  {lastResult.imageUrl && (
                    <button 
                      onClick={() => {
                        setEditingImage(lastResult.imageUrl);
                        setLastResult(null);
                        setActiveTab('geracao');
                        setUserInput('Edite esta imagem: ');
                        showToast('Modo de edição ativado (Instabilidade detectada)', 'warning');
                      }}
                      className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold border border-white/10 transition-all flex items-center justify-center gap-2 text-white/60 hover:text-white"
                    >
                      <Pencil size={16} />
                      Editar Imagem
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
