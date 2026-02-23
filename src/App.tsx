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
  ChevronRight,
  Upload
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
type Tab = 'geracao' | 'marca' | 'historico';
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

const Toast = ({ message, type = 'success', onClose }: { message: string, type?: 'success' | 'error', onClose: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 20 }}
    className={cn(
      "fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 z-50",
      type === 'success' ? "bg-emerald-600" : "bg-red-600"
    )}
  >
    {type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
    <span className="text-sm font-medium">{message}</span>
    <button onClick={onClose} className="ml-2 hover:opacity-70"><Plus size={16} className="rotate-45" /></button>
  </motion.div>
);

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
  const [openOverlay, setOpenOverlay] = useState<'boas-praticas' | 'postar' | null>(null);

  // History State
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  // UI State
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUserData(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadUserData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadUserData = async (userId: string) => {
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

    const userMsg: ChatMessage = { role: 'user', content: userInput, timestamp: Date.now() };
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

      // 3. Build Gemini Request
      const formatLabels = {
        texto: 'caption only (no image)',
        quadrado: '1:1 square image',
        retrato: '3:4 portrait image',
        story: '9:16 story image'
      };

      const isTextOnly = selectedFormat === 'texto';

      const systemInstruction = isTextOnly 
        ? `You are a professional social media copywriter. Write a caption in Brazilian Portuguese for a brand with the following identity:
Colors: ${brandInfo.colors.join(', ')}. Tone of voice: ${brandInfo.tone}. Brand personality: ${brandInfo.personality}.
Include relevant hashtags matching the brand tone. DO NOT generate any image description or image content.`
        : `You are a professional social media designer. Generate a ${formatLabels[selectedFormat]} for a brand with the following identity:
Colors: ${brandInfo.colors.join(', ')}. Tone of voice: ${brandInfo.tone}. Brand personality: ${brandInfo.personality}.
The brand logo is included as a reference image — incorporate it visibly in the composition.
The other reference images show the brand's visual style — follow that aesthetic.
Also write a caption in Brazilian Portuguese with relevant hashtags matching the brand tone.
Return the image and then the caption text separated by "---CAPTION---".`;

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

      const lastMessageParts: any[] = [{ text: userInput }];
      if (!isTextOnly) {
        if (logoBase64) lastMessageParts.push({ inlineData: { mimeType: 'image/png', data: logoBase64 } });
        refsBase64.forEach(data => {
          if (data) lastMessageParts.push({ inlineData: { mimeType: 'image/png', data } });
        });
      }

      const imageConfigMap: Record<string, string> = {
        quadrado: '1:1',
        retrato: '3:4',
        story: '9:16'
      };

      const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      
      const config: any = {
        systemInstruction: systemInstruction,
        generationConfig: {
          responseModalities: isTextOnly ? ["TEXT"] : ["TEXT", "IMAGE"]
        }
      };

      if (!isTextOnly) {
        config.imageConfig = {
          aspectRatio: imageConfigMap[selectedFormat] || '1:1'
        };
      }

      const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash-image",
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
      setLastResult({ imageUrl, caption });
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
        const path = type === 'logo' 
          ? `brand-assets/${session.user.id}/logo` 
          : `brand-assets/${session.user.id}/ref-${index}`;
        
        const { error: uploadError } = await supabase.storage
          .from('brand-assets')
          .upload(path, file, { upsert: true });
        
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('brand-assets')
          .getPublicUrl(path);

        if (type === 'logo') {
          setBrand(prev => ({ ...prev, logo_url: publicUrl }));
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

  const loadHistory = async (page = 0) => {
    try {
      const { data, error } = await supabase.storage
        .from('generated-arts')
        .list(session.user.id, {
          limit: 12,
          offset: page * 12,
          sortBy: { column: 'created_at', order: 'desc' }
        });
      
      if (error) throw error;

      const itemsWithUrls = data.map(item => ({
        ...item,
        url: supabase.storage.from('generated-arts').getPublicUrl(`${session.user.id}/${item.name}`).data.publicUrl
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
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-brand" size={48} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div 
          className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl border border-white/5 shadow-2xl"
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl font-display font-bold mb-2">
              Míd<span className="text-brand">IAs</span>
            </h1>
            <p className="text-white/60">Gere criativos e legendas com base na sua marca.</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-1.5 ml-1">E-mail</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand transition-colors"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/40 mb-1.5 ml-1">Senha</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand transition-colors"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-brand hover:bg-brand/90 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-brand/20"
            >
              {authMode === 'login' ? 'Entrar' : 'Criar Conta'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="text-sm text-white/40 hover:text-brand transition-colors"
            >
              {authMode === 'login' ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-bg overflow-hidden">
      {/* Left Panel - 440px */}
      <aside className="w-full md:w-[440px] flex-shrink-0 border-r border-white/5 flex flex-col h-screen bg-[#0a0a0a]">
        {/* Header */}
        <header className="p-6 border-bottom border-white/5">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-display font-bold">
              Míd<span className="text-brand">IAs</span>
            </h1>
            <div className="flex items-center gap-3">
              <div className="bg-white/5 px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
                <span className="text-xs font-medium text-white/60">💳 Créditos:</span>
                <span className="text-sm font-bold text-brand">{credits}</span>
                <a href="#" className="text-[10px] text-white/40 hover:text-white underline ml-1">Adicionar</a>
              </div>
              <button onClick={handleLogout} className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors">
                <LogOut size={18} />
              </button>
            </div>
          </div>
          <p className="text-xs text-white/40">Gere criativos e legendas com base na sua marca.</p>
        </header>

        {/* Tabs Navigation */}
        <nav className="px-6 py-2 flex gap-1 border-b border-white/5">
          {[
            { id: 'geracao', icon: LayoutGrid, label: 'Geração' },
            { id: 'marca', icon: Palette, label: 'Marca' },
            { id: 'historico', icon: History, label: 'Histórico' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id ? "bg-brand text-white shadow-lg shadow-brand/20" : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'geracao' && (
              <motion.div 
                key="geracao"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex flex-col h-full"
              >
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold">Geração</h2>
                      <p className="text-xs text-white/40">Prompt + formato → imagem e legenda</p>
                    </div>
                    <button className="p-2 hover:bg-white/5 rounded-lg text-white/40">
                      <RefreshCw size={18} />
                    </button>
                  </div>

                  {/* Format Selector */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { id: 'texto', icon: Type, label: 'Texto (ideia / legenda)', cost: 2 },
                      { id: 'quadrado', icon: Square, label: 'Quadrado (1:1)', cost: 10 },
                      { id: 'retrato', icon: RectangleVertical, label: 'Retrato (4:5)', cost: 10 },
                      { id: 'story', icon: Monitor, label: 'Story (9:16)', cost: 10 }
                    ].map(format => (
                      <button
                        key={format.id}
                        onClick={() => setSelectedFormat(format.id as Format)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                          selectedFormat === format.id 
                            ? "bg-brand/10 border-brand text-white" 
                            : "bg-white/5 border-white/5 text-white/40 hover:border-white/20"
                        )}
                      >
                        <format.icon size={18} />
                        <div>
                          <p className="text-xs font-bold">{format.label}</p>
                          <p className="text-[10px] opacity-60">{format.cost} créditos</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Info Bar */}
                  <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg border border-white/5 text-[10px] text-white/40">
                    <div className="flex items-center gap-2">
                      {brand.logo_url ? (
                        <span className="text-emerald-500 flex items-center gap-1">Logo ok ✓</span>
                      ) : (
                        <span className="text-white/20">Sem logo</span>
                      )}
                      <span className="w-1 h-1 bg-white/10 rounded-full" />
                      <span>{JSON.parse(brand.reference_images || '[]').length}/3 refs</span>
                    </div>
                    <span>Custo: {getCreditCost(selectedFormat)} créditos</span>
                  </div>
                </div>

                {/* Chat Interface */}
                <div className="flex-1 flex flex-col bg-black/40 rounded-2xl border border-white/5 overflow-hidden">
                  <div className="p-4 border-b border-white/5">
                    <h3 className="text-sm font-bold">Chat IA Gestor de Mídias</h3>
                    <p className="text-[10px] text-white/40">Peça artes e legendas como numa conversa</p>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={cn("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}>
                        <div className={cn(
                          "max-w-[85%] p-3 rounded-2xl text-sm",
                          msg.role === 'user' ? "bg-brand text-white rounded-tr-none" : "bg-white/5 text-white/80 rounded-tl-none border border-white/5"
                        )}>
                          <div className="markdown-body">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                          {msg.imageUrl && (
                            <div className="mt-3 rounded-lg overflow-hidden border border-white/10">
                              <img src={msg.imageUrl} alt="Generated" className="w-full h-auto" />
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] text-white/20 mt-1 px-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-4 bg-white/5 border-t border-white/5">
                    <div className="relative">
                      <textarea
                        value={userInput}
                        onChange={e => setUserInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder="Descreva sua arte..."
                        className="w-full bg-black/60 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-brand resize-none h-20"
                      />
                      <button 
                        onClick={handleSendMessage}
                        disabled={isGenerating || !userInput.trim()}
                        className="absolute right-3 bottom-3 p-2 bg-brand disabled:bg-white/10 text-white rounded-lg transition-all"
                      >
                        {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'marca' && (
              <motion.div 
                key="marca"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-8 pb-10"
              >
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-4">Identidade Visual</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Logo Upload */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-white/60">Logo da Marca</label>
                      <div 
                        onClick={() => handleFileUpload('logo')}
                        className="aspect-square bg-white/5 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-brand/50 transition-all overflow-hidden relative group"
                      >
                        {brand.logo_url ? (
                          <>
                            <img src={brand.logo_url} className="w-full h-full object-contain p-4" alt="Logo" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                              <Upload size={24} />
                            </div>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="text-white/20 mb-2" size={32} />
                            <span className="text-[10px] text-white/40">Upload Logo</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Reference Images */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-white/60">Referências (Estilo)</label>
                      <div className="grid grid-cols-2 grid-rows-2 gap-2 h-full max-h-[160px]">
                        {[0, 1, 2].map(i => {
                          const refs = JSON.parse(brand.reference_images || '[]');
                          return (
                            <div 
                              key={i}
                              onClick={() => handleFileUpload('ref', i)}
                              className="bg-white/5 border border-dashed border-white/10 rounded-lg flex items-center justify-center cursor-pointer hover:border-brand/50 overflow-hidden relative group"
                            >
                              {refs[i] ? (
                                <>
                                  <img src={refs[i]} className="w-full h-full object-cover" alt={`Ref ${i}`} />
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                    <Plus size={16} />
                                  </div>
                                </>
                              ) : (
                                <Plus className="text-white/20" size={20} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-4">Cores da Marca</h3>
                  <div className="flex gap-3">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div key={i} className="flex flex-col items-center gap-2">
                        <div className="relative w-12 h-12 rounded-full border border-white/10 overflow-hidden">
                          <input 
                            type="color" 
                            value={brand.colors[i] || '#000000'}
                            onChange={e => {
                              const newColors = [...brand.colors];
                              newColors[i] = e.target.value;
                              setBrand(prev => ({ ...prev, colors: newColors }));
                            }}
                            className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                          />
                        </div>
                        <span className="text-[10px] font-mono text-white/40 uppercase">{(brand.colors[i] || '#000000').slice(1)}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-4">Personalidade & Tom</h3>
                  
                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-2">Tom de Voz</label>
                    <select 
                      value={brand.tone_of_voice}
                      onChange={e => setBrand(prev => ({ ...prev, tone_of_voice: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand"
                    >
                      <option className="bg-[#1a1a1a]">Profissional</option>
                      <option className="bg-[#1a1a1a]">Amigável</option>
                      <option className="bg-[#1a1a1a]">Motivador</option>
                      <option className="bg-[#1a1a1a]">Divertido</option>
                      <option className="bg-[#1a1a1a]">Personalizado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/60 mb-2">Descrição da Personalidade</label>
                    <textarea 
                      value={(brand.personality || brand.brand_personality) || ''}
                      onChange={e => setBrand(prev => ({ ...prev, personality: e.target.value, brand_personality: e.target.value }))}
                      placeholder="Descreva como sua marca se comporta e o que ela valoriza..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand h-32 resize-none"
                    />
                  </div>
                </section>

                <button 
                  onClick={handleSaveBrand}
                  className="w-full bg-brand text-white font-bold py-4 rounded-xl shadow-lg shadow-brand/20 hover:bg-brand/90 transition-all flex items-center justify-center gap-2"
                >
                  <Check size={20} />
                  Salvar Marca
                </button>
              </motion.div>
            )}

            {activeTab === 'historico' && (
              <motion.div 
                key="historico"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Histórico</h2>
                  <p className="text-xs text-white/40">Suas artes geradas</p>
                </div>

                {historyItems.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                      <ImageIcon className="text-white/20" size={32} />
                    </div>
                    <p className="text-sm text-white/40">Nenhuma arte gerada ainda. Comece criando sua primeira arte!</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {historyItems.map((item, i) => (
                        <div key={i} className="group relative aspect-square bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                          <img src={item.url} className="w-full h-full object-cover" alt="History" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center p-4">
                            <p className="text-[10px] text-white/60 mb-3">{new Date(item.created_at).toLocaleDateString()}</p>
                            <div className="flex gap-2">
                              <a 
                                href={item.url} 
                                download 
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download size={16} />
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {hasMoreHistory && (
                      <button 
                        onClick={() => loadHistory(historyPage + 1)}
                        className="w-full py-3 text-sm text-white/40 hover:text-white hover:bg-white/5 rounded-xl border border-white/5 transition-all"
                      >
                        Carregar mais
                      </button>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* Right Panel - Result Area */}
      <main className="flex-1 flex flex-col h-screen bg-bg relative">
        {/* Floating Icons Bar (Left side of right panel) */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-40">
          <div className="relative group">
            <button 
              onClick={() => setOpenOverlay(openOverlay === 'boas-praticas' ? null : 'boas-praticas')}
              onMouseEnter={() => setOpenOverlay('boas-praticas')}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all bg-[#1a1a1a] border border-white/10 shadow-xl",
                openOverlay === 'boas-praticas' ? "text-brand border-brand" : "text-white/40 hover:text-white"
              )}
            >
              <AlertCircle size={20} />
            </button>
            
            <AnimatePresence>
              {openOverlay === 'boas-praticas' && (
                <motion.div 
                  initial={{ opacity: 0, x: 20, scale: 0.9 }}
                  animate={{ opacity: 1, x: 60, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.9 }}
                  className="absolute left-0 top-0 w-72 bg-[#1a1a1a] p-6 rounded-3xl border border-white/10 shadow-2xl z-50"
                  onMouseLeave={() => setOpenOverlay(null)}
                >
                  <h4 className="text-xs font-bold uppercase tracking-widest text-brand mb-4">Boas Práticas</h4>
                  <ul className="space-y-3 text-xs text-white/60 leading-relaxed">
                    <li className="flex gap-2">
                      <span className="text-brand">•</span>
                      Envie 1–3 referências do seu feed para manter consistência.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand">•</span>
                      Inclua objetivo, oferta, público e CTA no prompt.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand">•</span>
                      Salve sua marca antes de gerar para melhor resultado.
                    </li>
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative group">
            <button 
              onClick={() => setOpenOverlay(openOverlay === 'postar' ? null : 'postar')}
              onMouseEnter={() => setOpenOverlay('postar')}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all bg-[#1a1a1a] border border-white/10 shadow-xl",
                openOverlay === 'postar' ? "text-brand border-brand" : "text-white/40 hover:text-white"
              )}
            >
              <Instagram size={20} />
            </button>

            <AnimatePresence>
              {openOverlay === 'postar' && (
                <motion.div 
                  initial={{ opacity: 0, x: 20, scale: 0.9 }}
                  animate={{ opacity: 1, x: 60, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.9 }}
                  className="absolute left-0 top-0 w-72 bg-[#1a1a1a] p-6 rounded-3xl border border-white/10 shadow-2xl z-50"
                  onMouseLeave={() => setOpenOverlay(null)}
                >
                  <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Postar agora / Agendar</h4>
                  <div className="space-y-3">
                    <button className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold border border-white/10 transition-all flex items-center justify-center gap-2">
                      <Instagram size={14} />
                      Conectar Instagram (Meta)
                    </button>
                    <button className="w-full py-3 text-[10px] text-white/40 hover:text-white transition-all flex items-center justify-center gap-1">
                      Ir para Conexões
                      <ChevronRight size={10} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Backdrop for closing overlays */}
        {openOverlay && (
          <div 
            className="absolute inset-0 z-30" 
            onClick={() => setOpenOverlay(null)}
          />
        )}

        <div className="flex-1 flex flex-col overflow-y-auto">
          {isGenerating ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-6">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-brand/20 rounded-full animate-pulse" />
                <Loader2 className="absolute inset-0 m-auto text-brand animate-spin" size={40} />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-display font-bold mb-2">Gerando seu pedido com IA...</h2>
                <p className="text-white/40">Isso pode levar alguns segundos.</p>
              </div>
            </div>
          ) : lastResult ? (
            <div className="flex-1 p-8 md:p-12 flex flex-col items-center">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl space-y-8"
              >
                {/* Image Result */}
                <div className="relative group">
                  <div className={cn(
                    "bg-[#1a1a1a] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex items-center justify-center",
                    selectedFormat === 'quadrado' ? "aspect-square" : 
                    selectedFormat === 'retrato' ? "aspect-[4/5]" : 
                    selectedFormat === 'story' ? "aspect-[9/16] max-h-[70vh]" : "min-h-[200px]"
                  )}>
                    {lastResult.imageUrl ? (
                      <img src={lastResult.imageUrl} className="w-full h-full object-contain" alt="Result" />
                    ) : (
                      <div className="flex flex-col items-center text-white/20">
                        <Type size={64} />
                        <p className="mt-4 font-bold">Legenda Gerada</p>
                      </div>
                    )}
                  </div>
                  
                  {lastResult.imageUrl && (
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <a 
                        href={lastResult.imageUrl} 
                        download 
                        className="p-3 bg-black/60 backdrop-blur-md hover:bg-brand rounded-full text-white transition-all shadow-xl"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download size={20} />
                      </a>
                    </div>
                  )}
                </div>

                {/* Caption Result */}
                <div className="bg-[#1a1a1a] rounded-3xl border border-white/10 p-6 shadow-xl relative group">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-white/40">Legenda Sugerida</h4>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(lastResult.caption);
                        showToast('Legenda copiada!');
                      }}
                      className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-all flex items-center gap-2 text-xs"
                    >
                      <Copy size={14} />
                      Copiar
                    </button>
                  </div>
                  <div className="text-white/80 leading-relaxed markdown-body">
                    <ReactMarkdown>{lastResult.caption}</ReactMarkdown>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-4 justify-center">
                  <button className="px-8 py-4 bg-brand text-white font-bold rounded-2xl shadow-lg shadow-brand/20 hover:scale-105 transition-all flex items-center gap-3">
                    <Instagram size={20} />
                    Usar no Instagram
                  </button>
                  <button 
                    onClick={() => setLastResult(null)}
                    className="px-8 py-4 bg-white/5 text-white font-bold rounded-2xl border border-white/10 hover:bg-white/10 transition-all flex items-center gap-3"
                  >
                    <Plus size={20} />
                    Nova Arte
                  </button>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 opacity-20">
              <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mb-6">
                <ImageIcon size={64} />
              </div>
              <p className="text-xl font-display font-medium">Sua obra de arte aparecerá aqui</p>
            </div>
          )}
        </div>
      </main>

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
