import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Layers, Users, BarChart2, Shield, ArrowRight, Check, X } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleCTA = () => {
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-x-hidden selection:bg-indigo-600/30 selection:text-indigo-200">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute top-1/2 right-1/4 w-[600px] h-[600px] bg-indigo-500/5 blur-[180px] rounded-full pointer-events-none"></div>

      {/* Header / Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/70 border-b border-slate-900 px-6 md:px-12 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
          <img src="/logo.png" alt="WorkSphere Logo" className="h-12 w-auto object-contain" />
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#security" className="hover:text-white transition-colors">Security</a>
        </nav>

        <div className="flex items-center gap-4">
          {user ? (
            <button
              onClick={() => navigate("/dashboard")}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/20 hover:-translate-y-0.5"
            >
              Go to Dashboard
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate("/login")}
                className="text-sm font-bold text-slate-400 hover:text-white transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate("/login")}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/20 hover:-translate-y-0.5"
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-6 md:px-12 max-w-6xl mx-auto flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs font-semibold text-indigo-400 mb-6 shrink-0">
          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></span>
          Real-time Cloud Workspace
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent max-w-4xl">
          Real-time Team Pipelines, Simplified.
        </h1>

        <p className="text-slate-400 text-base md:text-lg max-w-2xl mt-6 leading-relaxed">
          The ultimate collaborative dashboard to manage task cards, delegate roles, and inspect live developer workloads in real-time.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-10">
          <button
            onClick={handleCTA}
            className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/25 hover:-translate-y-0.5 flex items-center gap-2 group"
          >
            <span>Start Free Workspace</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
          <a
            href="#pricing"
            className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-white font-bold rounded-xl transition-all hover:-translate-y-0.5"
          >
            View Pricing
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 border-t border-slate-900 bg-slate-950/40">
        <div className="max-w-6xl mx-auto px-6 md:px-12">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Engineered for Fast Teams</h2>
            <p className="text-slate-400 text-sm mt-3">Everything you need to streamline workflow pipelines and monitor project analytics.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 w-11 h-11 flex items-center justify-center mb-5 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base">Drag & Drop Boards</h4>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">Smooth interactive columns to easily organize tasks, set priorities, and update workflow pipelines.</p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 w-11 h-11 flex items-center justify-center mb-5 shrink-0">
                <BarChart2 className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base">Live Team Analytics</h4>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">Inspect priority breakdowns, column allocations, and developer workloads in real-time charts.</p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 w-11 h-11 flex items-center justify-center mb-5 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base">RBAC Team Directory</h4>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">Assign roles (Owner, Admin, Member) and secure admin commands directly from the team roster.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 border-t border-slate-900">
        <div className="max-w-6xl mx-auto px-6 md:px-12">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Flexible Freemium Pricing</h2>
            <p className="text-slate-400 text-sm mt-3">Start free, upgrade whenever you need to scale up your organization.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free Plan */}
            <div className="p-8 bg-slate-900/40 border border-slate-900 rounded-3xl relative overflow-hidden flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-base text-slate-300">Free Tier</h4>
                <div className="flex items-baseline gap-1 mt-4">
                  <span className="text-4xl font-extrabold">$0</span>
                  <span className="text-xs text-slate-500">/ forever</span>
                </div>
                <p className="text-slate-400 text-xs mt-3 leading-relaxed">Great for individual developers looking to test their pipeline designs.</p>

                <ul className="space-y-3.5 mt-8 text-xs text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Create up to 1 Board</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Invite up to 3 Team Members</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-slate-500">
                    <X className="w-4 h-4 shrink-0" />
                    <span>Locked Analytics dashboard</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={handleCTA}
                className="w-full mt-8 py-3 bg-slate-800 hover:bg-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                Sign Up for Free
              </button>
            </div>

            {/* Pro Plan */}
            <div className="p-8 bg-indigo-950/20 border-2 border-indigo-600/80 rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-xl shadow-indigo-600/5">
              <div className="absolute top-4 right-4 px-2 py-0.5 bg-indigo-600 rounded text-[9px] font-bold tracking-wider uppercase">Most Popular</div>
              <div>
                <h4 className="font-bold text-base text-indigo-400">Workspace PRO</h4>
                <div className="flex items-baseline gap-1 mt-4">
                  <span className="text-4xl font-extrabold">$9</span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>
                <p className="text-slate-300 text-xs mt-3 leading-relaxed">Perfect for agency workflows and growing companies looking to monitor developer load charts.</p>

                <ul className="space-y-3.5 mt-8 text-xs text-slate-200">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="font-semibold text-white">Create Unlimited Boards</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="font-semibold text-white">Invite Unlimited Members</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="font-semibold text-white">Unlock full Team Analytics</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={handleCTA}
                className="w-full mt-8 py-3 bg-indigo-600 hover:bg-indigo-500 font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/20"
              >
                Upgrade Workspace Now
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-20 border-t border-slate-900 bg-slate-950/40">
        <div className="max-w-6xl mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="max-w-md">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 w-11 h-11 flex items-center justify-center mb-5 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight">Enterprise Governance Rules</h3>
            <p className="text-slate-400 text-xs mt-3 leading-relaxed">
              Your boards are guarded by enterprise-grade Security Rules. Only workspace Owners can manage roles, adjust column structures, or delete databases. Logs are permanently archived to maintain a strict audit trail.
            </p>
          </div>
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl font-mono text-[10px] text-slate-400 max-w-md w-full shrink-0 shadow-xl shadow-slate-950">
            <span className="text-indigo-400 font-bold">function</span> <span className="text-white">isAdminOrOwner()</span> &#123;
            <br />
            &nbsp;&nbsp;return isRegistered() && (
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;getUserRole() == 'Admin' ||
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;getUserRole() == 'Owner'
            <br />
            &nbsp;&nbsp;);
            <br />
            &#125;
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 px-6 md:px-12 text-center text-xs text-slate-600">
        <p>© 2026 WorkSphere. All rights reserved.</p>
      </footer>
    </div>
  );
}
