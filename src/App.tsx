/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { 
  Search, 
  Plus, 
  Globe, 
  Phone, 
  MapPin, 
  MessageSquare, 
  Mail, 
  Sparkles, 
  Filter, 
  ArrowUpDown, 
  LogOut,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateContent } from './services/geminiService';
import { db, auth } from './lib/firebase';

const provider = new GoogleAuthProvider();

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  WRITE = 'write',
  LIST = 'list'
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const statusColors: Record<string, string> = {
  'new': 'bg-blue-50 text-blue-700 border-blue-100',
  'contacted': 'bg-amber-50 text-amber-700 border-amber-100',
  'engaged': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'qualified': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'closed-won': 'bg-green-50 text-green-700 border-green-100',
  'closed-lost': 'bg-rose-50 text-rose-700 border-rose-100',
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [cityCountry, setCityCountry] = useState('');
  const [hasWebsite, setHasWebsite] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [leads, setLeads] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'businessName' | 'cityCountry' | 'status'>('businessName');
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => setUser(user));
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeads(leadsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'leads'));
    return () => unsubscribe();
  }, [user]);

  const filteredAndSortedLeads = leads
    .filter(lead => 
      (filterStatus === 'all' || lead.status === filterStatus) &&
      (lead.businessName.toLowerCase().includes(searchTerm.toLowerCase()) || 
       lead.cityCountry.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => a[sortBy].localeCompare(b[sortBy]));

  const handleUpdateStatus = async (leadId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leads/${leadId}`);
    }
  };

  const handleAddMessage = async (leadId: string, message: string) => {
    if (!message.trim()) return;
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        conversationHistory: arrayUnion({
          message,
          timestamp: new Date()
        })
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leads/${leadId}`);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setStatus('submitting');
    try {
      await addDoc(collection(db, 'leads'), {
        businessName,
        phoneNumber: phone,
        email,
        cityCountry,
        hasWebsite,
        websiteUrl: hasWebsite ? websiteUrl : '',
        createdAt: new Date(),
        status: 'new',
        conversationHistory: []
      });
      setStatus('success');
      setBusinessName('');
      setPhone('');
      setEmail('');
      setCityCountry('');
      setHasWebsite(false);
      setWebsiteUrl('');
      setTimeout(() => {
        setStatus('idle');
        setIsFormOpen(false);
      }, 1500);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'leads');
      setStatus('idle');
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') console.error('Login error:', error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 italic-none overflow-x-hidden">
        {/* Nav */}
        <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-md border-b border-slate-200/50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shadow-lg shadow-slate-200">
                <Sparkles className="text-white w-4 h-4" />
              </div>
              <span className="font-bold text-slate-900 tracking-tight text-xl">LeadGen AI</span>
            </motion.div>
            <motion.button 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={handleLogin} 
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </motion.button>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-32 pb-20 px-6 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-indigo-50/50 to-transparent -z-10 pointer-events-none" />
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <motion.span 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm"
              >
                <Sparkles className="w-3 h-3" />
                Trusted by 500+ Sales Teams
              </motion.span>
              <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight mb-6 leading-[1.1]">
                Turn your leads into <br />
                <motion.span 
                  initial={{ backgroundPosition: "0% 50%" }}
                  animate={{ backgroundPosition: "100% 50%" }}
                  transition={{ duration: 5, repeat: Infinity, repeatType: "reverse" }}
                  className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-[length:200%_auto]"
                >
                  loyal customers.
                </motion.span>
              </h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 1 }}
                className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed"
              >
                The AI-powered CRM that helps business owners capture, manage, and close leads with automated smart messaging.
              </motion.p>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <motion.button 
                  whileHover={{ scale: 1.05, boxShadow: "0 25px 50px -12px rgba(79, 70, 229, 0.25)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogin} 
                  className="btn-primary px-8 py-4 text-lg flex items-center justify-center gap-3 w-full sm:w-auto shadow-2xl shadow-indigo-100 group"
                >
                  Get Started for Free
                  <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                </motion.button>
                <div className="flex items-center gap-2 px-4 py-2 text-slate-400 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  No credit card required
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-white border-y border-slate-200/60 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="text-center mb-20">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-4xl font-bold text-slate-900 tracking-tight mb-4"
              >
                Everything you need to grow
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-slate-500 text-lg"
              >
                Built for speed, automation, and high-conversion sales teams.
              </motion.p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  title: 'AI Smart Messages',
                  desc: 'Generate tailored WhatsApp and Email responses using Gemini 1.5 Flash in seconds.',
                  icon: <Sparkles className="w-6 h-6 text-indigo-600" />,
                  color: 'bg-indigo-50',
                  border: 'hover:border-indigo-200'
                },
                {
                  title: 'Lead Pipeline',
                  desc: 'Organize your sales funnel with custom statuses from new to cold to closed-won.',
                  icon: <Filter className="w-6 h-6 text-blue-600" />,
                  color: 'bg-blue-50',
                  border: 'hover:border-blue-200'
                },
                {
                  title: 'Website Insights',
                  desc: 'Automatically pull context from lead websites to personalize your outreach.',
                  icon: <Globe className="w-6 h-6 text-emerald-600" />,
                  color: 'bg-emerald-50',
                  border: 'hover:border-emerald-200'
                }
              ].map((feature, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  whileHover={{ y: -10 }}
                  className={`glass-card p-10 rounded-[32px] border border-slate-100 transition-all duration-300 ${feature.border}`}
                >
                  <div className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center mb-8 shadow-sm`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-4">{feature.title}</h3>
                  <p className="text-slate-500 leading-relaxed text-lg">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-28 px-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto glass-card rounded-[40px] p-16 bg-slate-900 text-white shadow-3xl flex flex-col md:flex-row items-center justify-between gap-12 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 text-center md:text-left">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">Start your growth <br />journey today.</h2>
              <p className="text-slate-400 text-lg mb-8">Join the waitlist or sign in to explore the dashboard.</p>
            </div>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogin} 
              className="relative z-10 px-10 py-5 bg-white text-slate-900 font-bold rounded-2xl hover:bg-slate-50 transition-all shadow-2xl shrink-0 text-xl"
            >
              Launch Dashboard
            </motion.button>
          </motion.div>
        </section>

        <footer className="py-12 border-t border-slate-200/50">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 text-slate-400">
              <Sparkles className="w-4 h-4" />
              <span className="font-bold tracking-tight">LeadGen AI</span>
            </div>
            <p className="text-slate-400 text-sm italic-none">&copy; 2026 LeadGen AI. All rights reserved.</p>
            <div className="flex items-center gap-6 text-sm font-medium text-slate-400">
              <a href="#" className="hover:text-slate-600 transition-colors">Privacy</a>
              <a href="#" className="hover:text-slate-600 transition-colors">Terms</a>
              <a href="#" className="hover:text-slate-600 transition-colors">Help</a>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <Sparkles className="text-white w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight">LeadGen AI</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end mr-2 text-right">
              <span className="text-sm font-medium text-slate-900">{user.displayName}</span>
              <span className="text-xs text-slate-500 font-mono opacity-60 tracking-tighter">{user.email}</span>
            </div>
            <button onClick={() => signOut(auth)} className="p-2 hover:bg-slate-100 rounded-full transition-colors transition-colors text-slate-400 hover:text-slate-600">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Active Leads</h2>
              <button 
                onClick={() => setIsFormOpen(!isFormOpen)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add New Lead
              </button>
            </div>

            {/* Filter Bar */}
            <div className="glass-card rounded-xl p-4 flex flex-wrap gap-3">
              <div className="relative flex-grow min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search by name or city..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-base pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)} 
                  className="input-base py-2 w-auto appearance-none pr-8 cursor-pointer"
                >
                  <option value="all">Statuses</option>
                  {['new', 'contacted', 'engaged', 'qualified', 'closed-won', 'closed-lost'].map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-slate-400" />
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as any)} 
                  className="input-base py-2 w-auto appearance-none pr-8 cursor-pointer"
                >
                  <option value="businessName">Sort by Name</option>
                  <option value="cityCountry">Sort by City</option>
                  <option value="status">Sort by Status</option>
                </select>
              </div>
            </div>

            {/* List */}
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredAndSortedLeads.map((lead, index) => (
                  <motion.div
                    key={lead.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ 
                      y: -4, 
                      scale: 1.005,
                      boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.05), 0 8px 10px -6px rgb(0 0 0 / 0.05)"
                    }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    className="glass-card group hover:ring-1 hover:ring-indigo-500/20 transition-all rounded-xl p-5 overflow-hidden"
                  >
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="flex-grow">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-bold text-lg text-slate-900 tracking-tight">{lead.businessName}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[lead.status]}`}>
                            {lead.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {lead.phoneNumber}
                          </div>
                          {lead.email && (
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              {lead.email}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {lead.cityCountry}
                          </div>
                          {lead.hasWebsite && lead.websiteUrl && (
                            <a 
                              href={lead.websiteUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 hover:underline"
                            >
                              <Globe className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[150px]">{lead.websiteUrl.replace(/https?:\/\//, '')}</span>
                              <ExternalLink className="w-3" />
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col justify-end items-end gap-3 min-w-[120px]">
                        <select 
                          value={lead.status} 
                          onChange={(e) => handleUpdateStatus(lead.id, e.target.value)}
                          className="input-base py-1 px-2 text-xs w-auto appearance-none cursor-pointer bg-slate-50"
                        >
                          {['new', 'contacted', 'engaged', 'qualified', 'closed-won', 'closed-lost'].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-6 border-t border-slate-100 pt-5">
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare className="w-4 h-4 text-slate-400" />
                        <h4 className="font-semibold text-sm text-slate-700">Automation Hub</h4>
                      </div>
                      
                      <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                        <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                          {lead.conversationHistory?.length === 0 && (
                            <p className="text-slate-400 text-xs italic">No activity yet. Start with AI assistance below.</p>
                          )}
                          <AnimatePresence initial={false}>
                            {lead.conversationHistory?.map((chat: any, i: number) => (
                              <motion.div 
                                initial={{ opacity: 0, y: 4 }} 
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                key={i} 
                                className="flex gap-2 text-xs"
                              >
                                <span className="text-slate-400 shrink-0 select-none">•</span>
                                <p className="text-slate-600 leading-relaxed font-mono tracking-tighter opacity-80">{chat.message}</p>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                          <div className="relative">
                            <input 
                              id={`message-input-${lead.id}`}
                              type="text" 
                              placeholder="Type a message or use AI suggestions..."
                              className="input-base py-2.5 pr-12 text-sm bg-white"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddMessage(lead.id, e.currentTarget.value);
                                  e.currentTarget.value = '';
                                }
                              }}
                            />
                            <div className="absolute right-1 top-1/2 -translate-y-1/2">
                              <button 
                                onClick={() => {
                                  const el = document.getElementById(`message-input-${lead.id}`) as HTMLInputElement;
                                  if (el && el.value.trim()) {
                                    handleAddMessage(lead.id, el.value);
                                    el.value = '';
                                  }
                                }}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Send Message"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            <button 
                              onClick={async () => {
                                const msg = await generateContent(lead, 'whatsapp');
                                const el = document.getElementById(`message-input-${lead.id}`) as HTMLInputElement;
                                if (el) el.value = msg;
                              }}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors border border-indigo-100"
                            >
                              <Sparkles className="w-3 h-3" />
                              WhatsApp Suggestion
                            </button>
                            <button 
                              onClick={async () => {
                                const msg = await generateContent(lead, 'email');
                                const el = document.getElementById(`message-input-${lead.id}`) as HTMLInputElement;
                                if (el) el.value = msg;
                              }}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors border border-blue-100"
                            >
                              <Mail className="w-3 h-3" />
                              Professional Email
                            </button>
                            <button 
                              onClick={async () => {
                                const msg = await generateContent(lead, 'email');
                                const el = document.getElementById(`message-input-${lead.id}`) as HTMLInputElement;
                                if (el) el.value = msg;
                              }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                            >
                              <ArrowUpDown className="w-3 h-3" />
                              Draft Suggestion
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Sidebar Area: Add Lead Form Overlay/Accordion */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 h-fit">
            <AnimatePresence>
              {isFormOpen && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass-card rounded-2xl p-6 mb-6 shadow-xl shadow-indigo-100/30 ring-1 ring-indigo-500/10"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                       <Plus className="w-5 h-5 text-indigo-600" />
                       New Prospect
                    </h2>
                    <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600 text-sm font-medium">Cancel</button>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Business Name</label>
                      <input 
                        type="text" 
                        value={businessName} 
                        onChange={(e) => setBusinessName(e.target.value)} 
                        className="input-base" 
                        required
                        placeholder="Company Inc."
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Phone</label>
                        <input 
                          type="text" 
                          value={phone} 
                          onChange={(e) => setPhone(e.target.value)} 
                          className="input-base" 
                          placeholder="+1 (555) 000"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Email</label>
                        <div className="relative">
                          <input 
                            type="email" 
                            value={email} 
                            onChange={(e) => {
                              const val = e.target.value;
                              setEmail(val);
                              if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                                setEmailError('Invalid email format');
                              } else {
                                setEmailError('');
                              }
                            }} 
                            className={`input-base ${emailError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' : ''}`} 
                            placeholder="john@company.com"
                            required
                          />
                        </div>
                        {emailError && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tight">{emailError}</p>}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Location</label>
                      <input 
                        type="text" 
                        value={cityCountry} 
                        onChange={(e) => setCityCountry(e.target.value)} 
                        className="input-base" 
                        placeholder="San Francisco, CA"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">Company Website?</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={hasWebsite} 
                        onChange={(e) => setHasWebsite(e.target.checked)} 
                        className="w-5 h-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
                      />
                    </div>

                    <AnimatePresence>
                      {hasWebsite && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-1.5 overflow-hidden"
                        >
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Website URL</label>
                          <div className="relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                              type="url" 
                              value={websiteUrl} 
                              onChange={(e) => setWebsiteUrl(e.target.value)} 
                              className="input-base pl-10" 
                              placeholder="https://..."
                              required
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button 
                      type="submit" 
                      className="btn-primary w-full py-3 mt-4 flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                      disabled={status === 'submitting' || !!emailError}
                    >
                      {status === 'submitting' ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : status === 'success' ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Prospect Added
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Create Opportunity
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {!isFormOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card rounded-2xl p-6 text-center"
              >
                <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">Add Prospect</h3>
                <p className="text-slate-500 text-sm mb-4">Ready to expand your pipeline? Add a new business lead here.</p>
                <button 
                  onClick={() => setIsFormOpen(true)}
                  className="btn-secondary w-full"
                >
                  Add a Lead
                </button>
              </motion.div>
            )}

            <div className="glass-card rounded-2xl p-6 mt-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-slate-400" />
                Status Guide
              </h3>
              <div className="space-y-3">
                {Object.entries(statusColors).map(([status, classes]) => (
                  <div key={status} className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-500 uppercase tracking-wider">{status}</span>
                    <span className={`px-2 py-0.5 rounded-full border ${classes}`}>{status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
