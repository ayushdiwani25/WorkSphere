import { useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { doc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (isSignUp) {
        const userCredential = await signup(email, password);
        const user = userCredential.user;

        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        const isFirstUser = usersSnapshot.empty;

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          role: isFirstUser ? 'Owner' : 'Member',
          tier: 'free', // Free plan by default
          joinedAt: serverTimestamp()
        });
        setSuccess('Account created successfully. You can now use your workspace.');
        navigate('/dashboard');
      } else {
        await login(email, password);
        navigate('/dashboard');
      }
    } catch (err) {
      const cleanMsg = (err.message || '')
        .replace(/^Firebase:\s*/i, '')
        .replace(/\(auth\/[^)]+\)\.?/i, '')
        .trim();
      setError(cleanMsg || 'Authentication failed. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <img 
              src="/logo.png" 
              alt="WorkSphere Logo" 
              className="h-12 w-auto object-contain cursor-pointer drop-shadow-md" 
              onClick={() => navigate("/")} 
            />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight text-center">
            Real Time Collaborative Task Management Workspace
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            {isSignUp ? 'Create your workspace account' : 'Sign in to manage team pipelines'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-medium">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="email" 
                required 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="developer@portfolio.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="password" 
                  required 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

          <button 
            type="submit" 
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl transition-colors shadow-lg shadow-indigo-600/20 mt-2"
          >
            {isSignUp ? 'Create Workspace Account' : 'Enter Workspace'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <button 
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setSuccess('');
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
          </button>
        </div>

      </div>
    </div>
  );
}