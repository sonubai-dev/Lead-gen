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
  Send,
  LayoutGrid,
  List,
  Zap,
  Layers,
  Users,
  Rocket,
  Target,
  CreditCard,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateContent, SalesScenario } from './services/geminiService';
import { db, auth } from './lib/firebase';

const provider = new GoogleAuthProvider();

const PIPELINE_STAGES = ['new', 'contacted', 'engaged', 'qualified', 'closed-won', 'closed-lost'];

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
  const [viewMode, setViewMode] = useState<'list' | 'pipeline'>('list');
  const [selectedScenarios, setSelectedScenarios] = useState<Record<string, SalesScenario>>({});
  const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({});

  const handleGenerate = async (lead: any, type: 'whatsapp' | 'email') => {
    const scenario = selectedScenarios[lead.id] || 'initial_outreach';
    setIsGenerating(prev => ({ ...prev, [lead.id]: true }));
    try {
      const msg = await generateContent(lead, type, scenario);
      const el = document.getElementById(`message-input-${lead.id}`) as HTMLInputElement;
      if (el) el.value = msg;
    } catch (error) {
      console.error("AI generation error:", error);
    } finally {
      setIsGenerating(prev => ({ ...prev, [lead.id]: false }));
    }
  };

  const handleOpenExternal = (lead: any, type: 'whatsapp' | 'email') => {
    const el = document.getElementById(`message-input-${lead.id}`) as HTMLInputElement;
    const msg = el?.value || "";
    if (type === 'whatsapp') {
      const cleanPhone = lead.phoneNumber.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      window.open(`mailto:${lead.email}?body=${encodeURIComponent(msg)}`, '_blank');
    }
    // Automatically add to history when opening externally
    if (msg) {
      handleAddMessage(lead.id, `[Sent via ${type.toUpperCase()}] ${msg}`);
    }
  };

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
    
    // Simple Validation
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Invalid email address');
      return;
    }
    if (hasWebsite && websiteUrl && !websiteUrl.startsWith('http')) {
      alert('Website URL must start with http:// or https://');
      return;
    }

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
      <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
        {/* Nav */}
        <nav className="fixed top-0 w-full z-50 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 group cursor-pointer">
              <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                <Sparkles className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-white tracking-tight text-xl">LeadGen<span className="text-indigo-400">.ai</span></span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              {['Features', 'How it Works', 'Pricing', 'Testimonials'].map((link) => (
                <a key={link} href={`#${link.toLowerCase().replace(/\s+/g, '-')}`} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
                  {link}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <button onClick={handleLogin} className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">
                Log In
              </button>
              <button onClick={handleLogin} className="hidden sm:block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-indigo-500/20">
                Sign Up
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-40 pb-24 px-6 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[600px] bg-indigo-600/10 blur-[120px] -z-10 rounded-full opacity-50" />
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-8"
              >
                <Zap className="w-3 h-3 fill-indigo-400" />
                The Future of Autonomous Outbound
              </motion.div>
              
              <h1 className="text-5xl md:text-8xl font-black text-white tracking-tight mb-8 leading-[0.95]">
                Scrape. Automate. <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-400 bg-[length:200%_auto] animate-gradient">Close at Scale.</span>
              </h1>
              
              <p className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
                The only platform that combines <span className="text-white">Precision Google Maps Scraping</span> with <span className="text-white">AI-Powered WhatsApp Automation</span> to turn strangers into loyal clients—autonomously.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <motion.button 
                  whileHover={{ scale: 1.05, boxShadow: "0 25px 50px -12px rgba(79, 70, 229, 0.4)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogin} 
                  className="px-8 py-5 bg-indigo-600 text-white text-lg font-bold rounded-2xl flex items-center gap-3 w-full sm:w-auto shadow-2xl shadow-indigo-500/20 group"
                >
                  Launch Your First Campaign
                  <ArrowUpDown className="w-5 h-5 group-hover:translate-x-1 transition-transform rotate-90" />
                </motion.button>
                <div className="flex -space-x-3 items-center">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-[#020617] bg-slate-800 flex items-center justify-center text-xs font-bold ring-2 ring-indigo-500/20">
                      U{i}
                    </div>
                  ))}
                  <div className="flex flex-col items-start ml-6 text-left">
                    <div className="flex text-amber-400">
                      {[1,2,3,4,5].map(i => <Sparkles key={i} className="w-3 h-3 fill-current" />)}
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Trusted by 2,400+ Founders</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* How It Works - Visual Storyboard */}
        <section id="how-it-works" className="py-24 px-6 bg-slate-950/50">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-end justify-between gap-8 mb-20">
              <div className="max-w-2xl">
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Built for lean teams with <span className="text-indigo-400 underline decoration-indigo-500/30 underline-offset-8">massive ambitions.</span></h2>
              </div>
              <p className="text-slate-400 text-lg md:max-w-sm">From pinpointing a local business to a signed contract in three effortless steps.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {[
                { 
                  step: "01", 
                  title: "Google Maps Discovery", 
                  desc: "Our hyper-threaded scraper extracts real-time business data, phone numbers, and social signals directly from Google Maps.",
                  icon: <MapPin className="w-8 h-8 text-indigo-500" />
                },
                { 
                  step: "02", 
                  title: "AI Intent Analysis", 
                  desc: "Gemini 1.5 Flash analyzes business websites to find pain points and crafts the perfect conversational hook.",
                  icon: <Sparkles className="w-8 h-8 text-violet-500" />
                },
                { 
                  step: "03", 
                  title: "Autonomous Outreach", 
                  desc: "Deploy WhatsApp agents that handle the first wave of questions and booking requests 24/7.",
                  icon: <Send className="w-8 h-8 text-emerald-500" />
                }
              ].map((item, i) => (
                <div key={i} className="relative group">
                  <div className="text-[120px] font-black text-white/5 absolute -top-20 -left-6 select-none group-hover:text-indigo-500/10 transition-colors">{item.step}</div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-8 border border-white/5 group-hover:border-indigo-500/50 transition-all group-hover:scale-110">
                      {item.icon}
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">{item.title}</h3>
                    <p className="text-slate-500 leading-relaxed text-lg">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section id="features" className="py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-4xl font-bold text-white mb-4">Enterprise Power. Startup Speed.</h2>
              <p className="text-slate-500">Everything you need to dominate your local market.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="col-span-1 md:col-span-8 bg-slate-900/40 rounded-[32px] p-10 border border-white/5 hover:border-indigo-500/30 transition-all flex flex-col md:flex-row gap-10">
                <div className="flex-1">
                  <div className="w-12 h-12 bg-indigo-600/10 rounded-xl flex items-center justify-center mb-6">
                    <Globe className="text-indigo-500 w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4 text-nowrap">Global Maps Intelligence</h3>
                  <p className="text-slate-500 leading-relaxed">Scape any city, any niche, any language. Get verified phone numbers, website context, and revenue signals at lightning speed.</p>
                </div>
                <div className="flex-1 bg-slate-950 rounded-2xl border border-white/5 p-6 flex flex-col justify-center">
                  <div className="space-y-3">
                    <div className="h-2 w-full bg-indigo-500/10 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} whileInView={{ width: "85%" }} className="h-full bg-indigo-500" />
                    </div>
                    <div className="h-2 w-full bg-violet-500/10 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} whileInView={{ width: "65%" }} className="h-full bg-violet-500" />
                    </div>
                    <div className="h-2 w-full bg-emerald-500/10 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} whileInView={{ width: "95%" }} className="h-full bg-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-1 md:col-span-4 bg-slate-900/40 rounded-[32px] p-10 border border-white/5 hover:border-violet-500/30 transition-all">
                <div className="w-12 h-12 bg-violet-600/10 rounded-xl flex items-center justify-center mb-6">
                  <Layers className="text-violet-500 w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Smart CRM</h3>
                <p className="text-slate-500 leading-relaxed">Visualize your pipeline with a drag-and-drop board designed for high-velocity sales.</p>
              </div>

              <div className="col-span-1 md:col-span-4 bg-slate-900/40 rounded-[32px] p-10 border border-white/5 hover:border-amber-500/30 transition-all">
                <div className="w-12 h-12 bg-amber-600/10 rounded-xl flex items-center justify-center mb-6">
                  <Users className="text-amber-500 w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Team Collaboration</h3>
                <p className="text-slate-500 leading-relaxed">Unified inbox for your whole sales force to jump in and close the deal.</p>
              </div>

              <div className="col-span-1 md:col-span-8 bg-slate-900/40 rounded-[32px] p-10 border border-white/5 hover:border-emerald-500/30 transition-all flex flex-col md:flex-row gap-10">
                <div className="flex-1">
                  <div className="w-12 h-12 bg-emerald-600/10 rounded-xl flex items-center justify-center mb-6">
                    <MessageSquare className="text-emerald-500 w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">WhatsApp AI Agent</h3>
                  <p className="text-slate-500 leading-relaxed">Deploy 24/7 AI agents that speak naturally, answer objections, and guide leads to the next step of your funnel.</p>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-white/5 text-[10px] ml-4 text-emerald-400">Hey, saw your plumbing service. Can you handle a burst pipe today?</div>
                  <div className="bg-indigo-600 p-3 rounded-xl text-[10px] mr-4 text-white">Absolutely! We have an engineer in SF right now. Would you like a quick quote?</div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-white/5 text-[10px] ml-4 text-emerald-400">Yes please!</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-24 px-6 bg-slate-950/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20 text-white">
              <h2 className="text-4xl font-bold mb-4">Simple, Scalable Pricing</h2>
              <p className="text-slate-500">Pick a plan that fits your growth ambitions.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { 
                  name: "Pro Starter", 
                  price: "$49", 
                  desc: "Ideal for solo-entrepreneurs",
                  features: ["500 Leads / month", "Google Maps Scraper", "AI Messaging Suggestions", "Standard Support"],
                  color: "border-white/5"
                },
                { 
                  name: "Growth Engine", 
                  price: "$99", 
                  desc: "Perfect for scaling agencies",
                  features: ["2,500 Leads / month", "Unlimited Scraping", "WhatsApp AI Agent Pro", "CRM Pipeline Access", "Priority Support"],
                  color: "border-indigo-500/50 shadow-2xl shadow-indigo-500/10",
                  popular: true
                },
                { 
                  name: "Enterprise", 
                  price: "Custom", 
                  desc: "For the big players",
                  features: ["Unlimited Everything", "Custom AI Models", "API Access", "Dedicated Success Manager", "White-label Options"],
                  color: "border-white/5"
                }
              ].map((plan, i) => (
                <div key={i} className={`relative p-10 rounded-[32px] bg-slate-900/60 border ${plan.color} flex flex-col`}>
                  {plan.popular && <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Most Popular</span>}
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-black text-white">{plan.price}</span>
                    {plan.price !== "Custom" && <span className="text-slate-500 text-sm">/mo</span>}
                  </div>
                  <p className="text-slate-500 text-sm mb-8">{plan.desc}</p>
                  <ul className="space-y-4 mb-10 flex-grow">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-3 text-sm text-slate-400">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={handleLogin} className={`w-full py-4 rounded-xl font-bold transition-all ${plan.popular ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-white/5 text-white hover:bg-white/10'}`}>
                    Get Started
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-20 px-6 border-t border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
              <div className="col-span-1 md:col-span-1">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <Sparkles className="text-white w-4 h-4" />
                  </div>
                  <span className="font-bold text-white tracking-tight text-xl">LeadGen<span className="text-indigo-400">.ai</span></span>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed">The next generation lead management system powered by AI and real-time data.</p>
              </div>
              <div>
                <h4 className="text-white font-bold mb-6">Product</h4>
                <ul className="space-y-4 text-sm text-slate-500">
                  <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Scraper</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">AI Agents</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-bold mb-6">Company</h4>
                <ul className="space-y-4 text-sm text-slate-500">
                  <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Legal</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-bold mb-6">Social</h4>
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-white/5 rounded-lg border border-white/5 flex items-center justify-center hover:bg-white/10 transition-all cursor-pointer">
                    <Globe className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="w-10 h-10 bg-white/5 rounded-lg border border-white/5 flex items-center justify-center hover:bg-white/10 transition-all cursor-pointer">
                    <Users className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>
            <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="text-slate-600 text-xs italic-none">&copy; 2026 LeadGen AI. Crafted for world-class sales teams.</p>
              <div className="flex gap-8 text-xs font-bold text-slate-600 uppercase tracking-widest">
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
              </div>
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
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Active Leads</h2>
                <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('pipeline')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'pipeline' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setIsFormOpen(!isFormOpen)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add New Lead
              </button>
            </div>

            {viewMode === 'list' ? (
              <>
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
                      {PIPELINE_STAGES.map(s => (
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

                {/* List View Rendering */}
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
                              {PIPELINE_STAGES.map(s => (
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
                              
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scenario:</label>
                                  <select 
                                    value={selectedScenarios[lead.id] || 'initial_outreach'}
                                    onChange={(e) => setSelectedScenarios(prev => ({ ...prev, [lead.id]: e.target.value as SalesScenario }))}
                                    className="input-base py-1 px-2 text-[10px] w-auto appearance-none cursor-pointer bg-white border-slate-200"
                                  >
                                    <option value="initial_outreach">Initial Outreach</option>
                                    <option value="follow_up">Follow Up</option>
                                    <option value="objection_handling">Objection Handling</option>
                                    <option value="special_offer">Special Offer</option>
                                  </select>
                                </div>
                                
                              <div className="flex flex-wrap gap-2">
                                  <div className="flex gap-1 group/btn">
                                    <button 
                                      onClick={() => handleGenerate(lead, 'whatsapp')}
                                      disabled={!!isGenerating[lead.id]}
                                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-l-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors border border-indigo-100 disabled:opacity-50"
                                    >
                                      {isGenerating[lead.id] ? (
                                        <div className="w-3 h-3 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                                      ) : (
                                        <Sparkles className="w-3 h-3" />
                                      )}
                                      Draft WhatsApp
                                    </button>
                                    <button 
                                      onClick={() => handleOpenExternal(lead, 'whatsapp')}
                                      className="px-2 py-1.5 bg-indigo-600 text-white rounded-r-lg text-[10px] font-bold uppercase hover:bg-indigo-700 transition-colors"
                                      title="Open WhatsApp Web"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  </div>

                                  <div className="flex gap-1 group/btn">
                                    <button 
                                      onClick={() => handleGenerate(lead, 'email')}
                                      disabled={!!isGenerating[lead.id]}
                                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-l-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors border border-blue-100 disabled:opacity-50"
                                    >
                                      {isGenerating[lead.id] ? (
                                        <div className="w-3 h-3 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                                      ) : (
                                        <Mail className="w-3 h-3" />
                                      )}
                                      Draft Email
                                    </button>
                                    <button 
                                      onClick={() => handleOpenExternal(lead, 'email')}
                                      className="px-2 py-1.5 bg-blue-600 text-white rounded-r-lg text-[10px] font-bold uppercase hover:bg-blue-700 transition-colors"
                                      title="Open Email Client"
                                    >
                                      <Mail className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <PipelineBoard leads={leads} onUpdateStatus={handleUpdateStatus} />
            )}
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

function PipelineBoard({ leads, onUpdateStatus }: { leads: any[]; onUpdateStatus: (id: string, s: string) => void }) {
  const statusColors: Record<string, string> = {
    'new': 'border-t-blue-400',
    'contacted': 'border-t-amber-400',
    'engaged': 'border-t-indigo-400',
    'qualified': 'border-t-emerald-400',
    'closed-won': 'border-t-green-400',
    'closed-lost': 'border-t-rose-400',
  };

  return (
    <div className="flex gap-6 overflow-x-auto pb-8 pt-2 custom-scrollbar">
      {PIPELINE_STAGES.map((stage) => {
        const stageLeads = leads.filter(l => l.status === stage);
        return (
          <div key={stage} className="flex-shrink-0 w-72 flex flex-col h-full">
            <div className={`mb-4 flex items-center justify-between border-t-2 pt-3 ${statusColors[stage]}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 uppercase tracking-wider">{stage.replace('-', ' ')}</span>
                <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{stageLeads.length}</span>
              </div>
            </div>
            
            <div className="flex-grow space-y-3 min-h-[500px] bg-slate-50/50 rounded-2xl p-2 border border-slate-100 border-dashed">
              <AnimatePresence mode="popLayout">
                {stageLeads.map((lead, i) => (
                  <motion.div
                    key={lead.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card p-4 rounded-xl shadow-sm hover:shadow-md transition-all group cursor-pointer"
                  >
                    <h4 className="font-bold text-slate-900 mb-1 text-sm">{lead.businessName}</h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-3">
                      <MapPin className="w-3 h-3" />
                      {lead.cityCountry}
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <div className="flex items-center -space-x-1">
                        <div className="w-5 h-5 rounded-full bg-indigo-100 border border-white flex items-center justify-center text-[8px] font-bold text-indigo-600">
                          {lead.businessName.charAt(0)}
                        </div>
                      </div>
                      <select 
                        value={lead.status} 
                        onChange={(e) => onUpdateStatus(lead.id, e.target.value)}
                        className="text-[10px] font-bold text-slate-400 bg-transparent border-none focus:ring-0 cursor-pointer hover:text-indigo-600 transition-colors"
                      >
                        {PIPELINE_STAGES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {stageLeads.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
                  <div className="w-8 h-8 rounded-full border border-slate-200 border-dashed flex items-center justify-center mb-2">
                    <Plus className="w-4 h-4 opacity-30" />
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-widest">No Leads</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
