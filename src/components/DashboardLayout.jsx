import { Navigate, Outlet, useNavigate, NavLink } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { LogOut, Users, Folder, Plus, Trash2, Crown, CreditCard, X, Settings } from "lucide-react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  doc,
  serverTimestamp,
  where,
  getDocs,
  writeBatch,
  updateDoc
} from "firebase/firestore";

const AVATAR_PRESETS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Jack",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Tigger",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Abby",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Leo"
];

export default function DashboardLayout() {
  const { user, logout, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  // Settings profile states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_PRESETS[0]);

  // Sync profile details when loaded
  useEffect(() => {
    if (currentUserProfile) {
      setProfileName(currentUserProfile.displayName || user.displayName || '');
      setSelectedAvatar(currentUserProfile.photoURL || user.photoURL || AVATAR_PRESETS[0]);
    }
  }, [currentUserProfile, user, isSettingsOpen]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) return;
    try {
      await updateUserProfile(profileName.trim(), selectedAvatar);
      await updateDoc(doc(db, "users", user.uid), {
        displayName: profileName.trim(),
        photoURL: selectedAvatar
      });
      setIsSettingsOpen(false);
    } catch (err) {
      console.error("Error saving profile:", err);
    }
  };

  // Payment Modal States
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  // Dynamically load Razorpay SDK
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Unified Payment Trigger (Checks for Razorpay Key)
  const handlePaymentTrigger = useCallback(() => {
    const rzpKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
    if (rzpKey) {
      const options = {
        key: rzpKey,
        amount: 900, // 900 paise = 9 INR
        currency: "INR",
        name: "WorkSphere",
        description: "PRO Workspace Subscription Upgrade",
        handler: async function () {
          try {
            await updateDoc(doc(db, "users", user.uid), {
              tier: 'pro'
            });
            alert("Upgrade successful! Your account is now PRO.");
          } catch (err) {
            console.error("Error upgrading user tier:", err);
          }
        },
        prefill: {
          email: user.email
        },
        theme: {
          color: "#4f46e5"
        }
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } else {
      // Fallback to mock popup
      setIsPayModalOpen(true);
    }
  }, [user]);

  // Listen for global open-checkout triggers
  useEffect(() => {
    const handleOpenCheckout = () => handlePaymentTrigger();
    window.addEventListener('open-checkout', handleOpenCheckout);
    return () => window.removeEventListener('open-checkout', handleOpenCheckout);
  }, [handlePaymentTrigger]);

  // Fetch active user profile dynamically in real-time
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUserProfile(docSnap.data());
      }
    });
    return unsubscribe;
  }, [user]);

  // Fetch boards in real-time
  useEffect(() => {
    if (!user) return;
    const boardsQuery = query(collection(db, "boards"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(boardsQuery, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setBoards(list);
    });
    return unsubscribe;
  }, [user]);

  // Create new board (1 Board limit on Free plan)
  const handleCreateBoard = async () => {
    if (currentUserProfile && currentUserProfile.tier !== 'pro' && boards.length >= 1) {
      handlePaymentTrigger();
      return;
    }
    const boardName = prompt("Enter new board name:");
    if (!boardName || !boardName.trim()) return;
    try {
      const docRef = await addDoc(collection(db, "boards"), {
        name: boardName.trim(),
        ownerId: user.uid,
        createdAt: serverTimestamp(),
      });
      navigate(`/dashboard/board/${docRef.id}`);
    } catch (err) {
      console.error("Error creating board:", err);
    }
  };

  // Mock payment processing handler
  const handleMockPayment = async (e) => {
    e.preventDefault();
    setIsPaying(true);
    setTimeout(async () => {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          tier: 'pro'
        });
        setIsPaying(false);
        setIsPayModalOpen(false);
        alert("Upgrade successful! Your account is now PRO.");
      } catch (err) {
        console.error("Error upgrading user:", err);
        setIsPaying(false);
      }
    }, 1500);
  };

  // Delete board and associated tasks/stages
  const handleDeleteBoard = async (boardId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this board, all its columns, and all its tasks?")) return;

    try {
      const batch = writeBatch(db);

      // Delete tasks associated with the board
      const tasksQuery = query(collection(db, "tasks"), where("boardId", "==", boardId));
      const tasksSnap = await getDocs(tasksQuery);
      tasksSnap.forEach((d) => batch.delete(doc(db, "tasks", d.id)));

      // Delete stages associated with the board
      const stagesQuery = query(collection(db, "stages"), where("boardId", "==", boardId));
      const stagesSnap = await getDocs(stagesQuery);
      stagesSnap.forEach((d) => batch.delete(doc(db, "stages", d.id)));

      // Delete board itself
      batch.delete(doc(db, "boards", boardId));

      await batch.commit();
      navigate("/dashboard");
    } catch (err) {
      console.error("Error deleting board:", err);
    }
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex bg-slate-50 relative">
      {/* Structural Workspace Sidebar */}
      <aside className="w-64 bg-slate-900 flex flex-col border-r border-slate-800 text-slate-400 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <img src="/logo.png" alt="WorkSphere Logo" className="h-9 w-auto object-contain cursor-pointer" onClick={() => navigate("/")} />
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
          {/* General Links */}
          <div className="space-y-1">
            <NavLink
              to="/dashboard/members"
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${isActive
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`
              }
            >
              <Users className="w-4 h-4" />
              <span>Team Members</span>
            </NavLink>
          </div>

          {/* Active Boards Section */}
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex justify-between items-center px-3 mb-2 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <span>Active Boards</span>
              <button
                onClick={handleCreateBoard}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-md transition-colors"
                title="Create New Board"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 overflow-y-auto max-h-[220px] pr-1">
              {boards.length === 0 ? (
                <div className="px-3 py-2 text-xs italic text-slate-600">
                  No active boards
                </div>
              ) : (
                boards.map((board) => (
                  <NavLink
                    key={board.id}
                    to={`/dashboard/board/${board.id}`}
                    className={({ isActive }) =>
                      `group w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${isActive
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Folder className="w-4 h-4 shrink-0" />
                      <span className="truncate">{board.name}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteBoard(board.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-700/60 rounded text-slate-400 hover:text-red-400 transition-all shrink-0"
                      title="Delete Board"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </NavLink>
                ))
              )}
            </div>
          </div>
        </nav>

        {/* Upgrade Workspace Callout */}
        {currentUserProfile?.tier !== 'pro' && (
          <div className="mx-4 my-2 p-3 bg-indigo-950/40 border border-indigo-500/20 rounded-xl">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
              <Crown className="w-3.5 h-3.5" />
              <span>Free Account Limits</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">1 Board, 3 Team Members, Locked Analytics.</p>
            <button
              onClick={handlePaymentTrigger}
              className="w-full mt-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[10px] rounded-lg transition-colors shadow-md shadow-indigo-600/10"
            >
              Upgrade to Pro ($9/mo)
            </button>
          </div>
        )}

        {/* User Profile Block */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              onClick={() => setIsSettingsOpen(true)}
              className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/50 flex items-center justify-center font-bold text-xs cursor-pointer hover:border-indigo-500 hover:scale-105 transition-all overflow-hidden shrink-0"
              title="Edit Profile"
            >
              {currentUserProfile?.photoURL || user.photoURL ? (
                <img src={currentUserProfile?.photoURL || user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white">{(currentUserProfile?.displayName || user.displayName || user.email).charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="min-w-0 cursor-pointer" onClick={() => setIsSettingsOpen(true)} title="Edit Profile">
              <p className="text-xs font-semibold text-white truncate hover:text-indigo-400 transition-colors">
                {currentUserProfile?.displayName || user.displayName || user.email.split('@')[0]}
              </p>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">
                {currentUserProfile?.tier === 'pro' ? '🚀 PRO' : 'Free Tier'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 hover:bg-slate-800 hover:text-slate-200 rounded-lg text-slate-500 transition-colors cursor-pointer"
              title="Profile Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => logout().then(() => navigate("/login"))}
              className="p-1.5 hover:bg-slate-800 hover:text-red-400 rounded-lg text-slate-500 transition-colors group cursor-pointer"
              title="Log Out"
            >
              <LogOut className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Dynamic View Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center px-8 shrink-0 justify-between">
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">
            Active Team Workflow Board
          </h1>

        </header>

        {/* Render nested routes inside this container */}
        <div className="flex-1 overflow-x-auto bg-slate-50/50">
          <Outlet />
        </div>
      </main>

      {/* Checkout Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative text-white">
            <button
              onClick={() => setIsPayModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center mb-6">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 mb-3">
                <Crown className="w-6 h-6 animate-bounce" />
              </div>
              <h3 className="text-lg font-bold">Upgrade to Workspace PRO</h3>
              <p className="text-slate-400 text-xs mt-1 text-center">Unlock unlimited boards, unlimited members, and full team analytics for only $9/month.</p>
            </div>

            <form onSubmit={handleMockPayment} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Card Number</label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="4242 4242 4242 4242"
                    maxLength="19"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Expiration</label>
                  <input
                    type="text"
                    required
                    placeholder="MM/YY"
                    maxLength="5"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">CVC</label>
                  <input
                    type="password"
                    required
                    placeholder="•••"
                    maxLength="3"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPaying}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/20 mt-2 flex items-center justify-center gap-2"
              >
                {isPaying ? (
                  <span>Processing secure payment...</span>
                ) : (
                  <>
                    <span>Pay $9.00 / month</span>
                  </>
                )}
              </button>
            </form>

            <p className="text-[9px] text-slate-500 mt-4 text-center">
              Secured by mock Stripe Checkout. Enter any dummy card numbers to complete the upgrade.
            </p>
          </div>
        </div>
      )}
      {/* Profile Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative text-white animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center mb-6">
              <h3 className="text-lg font-bold">Customize Profile</h3>
              <p className="text-slate-400 text-xs mt-1 text-center">Change your display name and choose an avatar.</p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-white placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Select Avatar</label>
                <div className="grid grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850">
                  {AVATAR_PRESETS.map((presetUrl) => {
                    const isSelected = selectedAvatar === presetUrl;
                    return (
                      <div
                        key={presetUrl}
                        onClick={() => setSelectedAvatar(presetUrl)}
                        className={`aspect-square rounded-lg border-2 flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-all p-1 bg-slate-900 ${isSelected ? 'border-indigo-500 bg-indigo-950/20' : 'border-transparent hover:border-slate-700'
                          }`}
                      >
                        <img src={presetUrl} alt="Avatar Preset" className="w-full h-full object-contain" />
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/20 mt-2 cursor-pointer"
              >
                Save Profile
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
