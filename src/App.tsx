import { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, ChevronRight, User, LogOut, Settings, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, startOfToday, isSameDay } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
}

interface Slot {
  start: string;
  end: string;
  available: boolean;
}

export default function App() {
  const [view, setView] = useState<'landing' | 'booking' | 'admin' | 'auth'>('landing');
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      setServices(data);
    } catch (e) {
      console.error('Failed to fetch services', e);
    }
  };

  const fetchSlots = async (date: Date, serviceId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/availability?date=${date.toISOString()}&serviceId=${serviceId}`);
      const data = await res.json();
      // In a real app, the server would return slots. 
      // For this demo, we'll simulate slot generation on client if server logic isn't fully wired
      const mockSlots = generateMockSlots(date, data.duration || 60);
      setSlots(mockSlots);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generateMockSlots = (date: Date, duration: number) => {
    const slots = [];
    const start = 9; // 9 AM
    const end = 17; // 5 PM
    for (let h = start; h < end; h++) {
      for (let m = 0; m < 60; m += duration) {
        const d = new Date(date);
        d.setHours(h, m, 0, 0);
        if (d > new Date()) {
          slots.push({
            start: d.toISOString(),
            end: new Date(d.getTime() + duration * 60000).toISOString(),
            available: Math.random() > 0.3
          });
        }
      }
    }
    return slots;
  };

  const handleBooking = async (slot: Slot) => {
    if (!user) {
      setView('auth');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/bookings/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService?.id,
          startTime: slot.start,
          userId: 'mock-user-id' // In real app, get from auth state
        })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      alert('Booking failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Navigation */}
      <nav className="border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('landing')}>
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Calendar className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">BookFlow</span>
          </div>
          
          <div className="flex items-center gap-6">
            {user ? (
              <>
                <button onClick={() => setView('admin')} className="text-sm font-medium hover:text-black/60 transition-colors">Dashboard</button>
                <button onClick={() => setUser(null)} className="flex items-center gap-2 text-sm font-medium text-red-500">
                  <LogOut size={16} /> Logout
                </button>
              </>
            ) : (
              <button onClick={() => setView('auth')} className="bg-black text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-black/80 transition-all">
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {view === 'landing' && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center max-w-3xl mx-auto"
            >
              <h1 className="text-6xl font-bold tracking-tighter mb-6 leading-tight">
                Seamless Booking for Your <span className="text-indigo-600">SaaS Business</span>
              </h1>
              <p className="text-xl text-black/60 mb-10">
                Automate your scheduling, accept payments, and sync with Google Calendar. 
                The all-in-one solution for service-based businesses.
              </p>
              <div className="flex items-center justify-center gap-4">
                <button 
                  onClick={() => setView('booking')}
                  className="bg-black text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:scale-105 transition-transform flex items-center gap-2"
                >
                  Book a Service <ChevronRight size={20} />
                </button>
                <button className="border border-black/10 px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-black/5 transition-colors">
                  View Pricing
                </button>
              </div>
            </motion.div>
          )}

          {view === 'booking' && (
            <motion.div 
              key="booking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12"
            >
              <div className="lg:col-span-4 space-y-6">
                <h2 className="text-2xl font-bold mb-6">Select a Service</h2>
                {services.length === 0 ? (
                  <div className="p-6 border border-dashed border-black/10 rounded-2xl text-center text-black/40">
                    No services available
                  </div>
                ) : (
                  services.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedService(s);
                        fetchSlots(selectedDate, s.id);
                      }}
                      className={cn(
                        "w-full p-6 rounded-2xl border text-left transition-all group",
                        selectedService?.id === s.id 
                          ? "border-black bg-black text-white shadow-xl" 
                          : "border-black/5 bg-white hover:border-black/20"
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg">{s.name}</h3>
                        <span className={cn("text-sm font-medium", selectedService?.id === s.id ? "text-white/60" : "text-black/40")}>
                          ${s.price}
                        </span>
                      </div>
                      <p className={cn("text-sm mb-4", selectedService?.id === s.id ? "text-white/70" : "text-black/60")}>
                        {s.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
                        <Clock size={14} /> {s.duration} MIN
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="lg:col-span-8">
                {selectedService ? (
                  <div className="bg-white rounded-3xl border border-black/5 p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-2xl font-bold">Choose Date & Time</h2>
                      <div className="flex gap-2">
                        {[0, 1, 2, 3, 4].map(i => {
                          const date = addDays(startOfToday(), i);
                          const active = isSameDay(date, selectedDate);
                          return (
                            <button
                              key={i}
                              onClick={() => {
                                setSelectedDate(date);
                                fetchSlots(date, selectedService.id);
                              }}
                              className={cn(
                                "flex flex-col items-center justify-center w-16 h-20 rounded-2xl transition-all",
                                active ? "bg-black text-white shadow-lg" : "hover:bg-black/5"
                              )}
                            >
                              <span className="text-[10px] uppercase font-bold opacity-60">{format(date, 'EEE')}</span>
                              <span className="text-xl font-bold">{format(date, 'd')}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {loading ? (
                      <div className="py-20 text-center text-black/40 animate-pulse">Loading slots...</div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {slots.map((slot, i) => (
                          <button
                            key={i}
                            disabled={!slot.available}
                            onClick={() => handleBooking(slot)}
                            className={cn(
                              "py-3 rounded-xl border text-sm font-medium transition-all",
                              slot.available 
                                ? "border-black/5 hover:border-black hover:bg-black hover:text-white" 
                                : "opacity-20 cursor-not-allowed bg-black/5"
                            )}
                          >
                            {format(new Date(slot.start), 'HH:mm')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-black/30 border-2 border-dashed border-black/5 rounded-3xl p-12">
                    <Calendar size={48} className="mb-4 opacity-20" />
                    <p className="text-lg font-medium">Please select a service to see availability</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'auth' && (
            <motion.div 
              key="auth"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto bg-white p-10 rounded-3xl border border-black/5 shadow-2xl"
            >
              <h2 className="text-3xl font-bold mb-8 text-center">Welcome Back</h2>
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setUser({ email: 'demo@example.com', role: 'ADMIN' }); setView('landing'); }}>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-black/40 mb-2">Email Address</label>
                  <input type="email" required className="w-full px-4 py-3 rounded-xl border border-black/10 focus:border-black outline-none transition-all" placeholder="name@company.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-black/40 mb-2">Password</label>
                  <input type="password" required className="w-full px-4 py-3 rounded-xl border border-black/10 focus:border-black outline-none transition-all" placeholder="••••••••" />
                </div>
                <button className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-black/80 transition-all mt-4">
                  Sign In
                </button>
              </form>
              <p className="text-center text-sm text-black/40 mt-6">
                Don't have an account? <button className="text-black font-bold">Create one</button>
              </p>
            </motion.div>
          )}

          {view === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h1 className="text-4xl font-bold tracking-tight">Admin Dashboard</h1>
                <div className="flex gap-3">
                  <button className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-bold">
                    <Plus size={18} /> New Service
                  </button>
                  <button className="p-2 border border-black/10 rounded-xl hover:bg-black/5">
                    <Settings size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Total Bookings', value: '128', trend: '+12%' },
                  { label: 'Revenue', value: '$4,290', trend: '+8%' },
                  { label: 'Active Services', value: '4', trend: '0%' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-widest text-black/40 mb-1">{stat.label}</p>
                    <div className="flex items-end justify-between">
                      <p className="text-3xl font-bold">{stat.value}</p>
                      <span className="text-emerald-500 text-xs font-bold">{stat.trend}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-black/5 flex justify-between items-center">
                  <h3 className="font-bold">Recent Bookings</h3>
                  <button className="text-xs font-bold text-indigo-600">View All</button>
                </div>
                <div className="divide-y divide-black/5">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="p-6 flex items-center justify-between hover:bg-black/[0.01] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="font-bold">John Doe</p>
                          <p className="text-xs text-black/40">Strategy Session • 60 min</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">Oct 24, 14:00</p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">
                          <CheckCircle size={10} /> Confirmed
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-black/5 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-black rounded flex items-center justify-center">
              <Calendar className="text-white w-4 h-4" />
            </div>
            <span className="font-bold tracking-tight">BookFlow</span>
          </div>
          <div className="flex gap-8 text-sm font-medium text-black/40">
            <a href="#" className="hover:text-black transition-colors">Privacy</a>
            <a href="#" className="hover:text-black transition-colors">Terms</a>
            <a href="#" className="hover:text-black transition-colors">Support</a>
          </div>
          <p className="text-sm text-black/20">© 2024 BookFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
