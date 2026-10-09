import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { Search, UserPlus, Shield, Mail, Calendar, Trash2, X, ShieldAlert } from 'lucide-react';

export default function TeamMembers() {
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Invite Modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Member');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // 1. Listen for workspace members in real-time
  useEffect(() => {
    const registerMissingProfile = async () => {
      try {
        await setDoc(doc(db, 'users', currentUser.uid), {
          uid: currentUser.uid,
          email: currentUser.email,
          role: 'Owner', // First/Main user is the Owner
          joinedAt: serverTimestamp()
        });
      } catch (err) {
        console.error('Error auto-registering missing profile:', err);
      }
    };

    const membersQuery = query(collection(db, 'users'), orderBy('joinedAt', 'desc'));
    const unsubscribe = onSnapshot(membersQuery, (snapshot) => {
      const fetchedMembers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Auto-register current user profile if it's missing (failsafe)
      const currentUserExists = fetchedMembers.some(m => m.uid === currentUser?.uid);
      if (!currentUserExists && currentUser) {
        registerMissingProfile();
      }

      setMembers(fetchedMembers);
    });

    return unsubscribe;
  }, [currentUser]);

  // Extract the logged-in user's role from the roster
  const loggedInMemberProfile = members.find(m => m.uid === currentUser?.uid);
  const currentUserRole = loggedInMemberProfile?.role || 'Member';

  // Update member role
  const handleUpdateRole = async (memberId, newRole) => {
    try {
      await updateDoc(doc(db, 'users', memberId), {
        role: newRole
      });
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  // Remove member
  const handleRemoveMember = async (member) => {
    if (member.uid === currentUser?.uid) {
      alert("You cannot remove yourself from the workspace!");
      return;
    }
    if (!window.confirm(`Are you sure you want to remove ${member.email} from the workspace?`)) return;

    try {
      await deleteDoc(doc(db, 'users', member.id));
    } catch (err) {
      console.error('Error removing member:', err);
    }
  };

  // Handle Simulated and Real Email Invite
  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setInviteError('');
    if (!inviteEmail.trim()) {
      setInviteError('Email is required');
      return;
    }

    setIsSubmitting(true);
    
    // Check subscription limits (3 members limit on Free Tier)
    const isFreeTier = loggedInMemberProfile?.tier !== 'pro';
    if (isFreeTier && members.length >= 3) {
      setInviteError('Workspace has reached the 3-member limit for Free accounts. Upgrade your workspace to Pro to invite more members!');
      setIsSubmitting(false);
      return;
    }

    try {
      // Check if user already exists
      const exists = members.some(m => m.email.toLowerCase() === inviteEmail.trim().toLowerCase());
      if (exists) {
        setInviteError('User is already a member of this workspace');
        setIsSubmitting(false);
        return;
      }

      // 1. Generate a simulated user profile for testing collaboration
      const dummyUid = `simulated_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'users', dummyUid), {
        uid: dummyUid,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        joinedAt: serverTimestamp()
      });

      // 2. Trigger Real Email via EmailJS REST API (if configured in .env)
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

      if (serviceId && templateId && publicKey) {
        try {
          const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              service_id: serviceId,
              template_id: templateId,
              user_id: publicKey,
              template_params: {
                to_email: inviteEmail.trim().toLowerCase(),
                email: inviteEmail.trim().toLowerCase(), // backup variable for template compatibility
                invited_by: currentUser.email,
                role: inviteRole,
                login_link: window.location.origin + '/login'
              }
            })
          });

          if (!response.ok) {
            console.warn('EmailJS invitation email failed to send:', await response.text());
          } else {
            console.log('Real email invitation successfully sent to:', inviteEmail);
          }
        } catch (mailErr) {
          console.error('Error sending real email via EmailJS:', mailErr);
        }
      } else {
        console.log('Real email invitation skipped (VITE_EMAILJS keys not found in .env)');
      }

      setInviteEmail('');
      setIsInviteOpen(false);
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter members by search input
  const filteredMembers = members.filter(member => 
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Date Formatter Helper
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get style class for role badges
  const getRoleBadgeStyle = (role) => {
    switch (role?.toLowerCase()) {
      case 'owner':
        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'admin':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="p-8 h-[calc(100vh-4rem)] flex flex-col">
      {/* Upper Control Bar */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Workspace Collaboration</h2>
          <p className="text-xs text-slate-400">View and manage developers connected to this workspace</p>
        </div>
        
        {/* Hide invite actions from regular members */}
        {(currentUserRole === 'Owner' || currentUserRole === 'Admin') && (
          <button
            onClick={() => {
              setInviteRole('Member');
              setIsInviteOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/10 transition-all hover:-translate-y-0.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Member</span>
          </button>
        )}
      </div>

      {/* Roster Search Control */}
      <div className="mb-6 max-w-md relative shrink-0">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search team members by email..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
        />
      </div>

      {/* Roster Listing Table */}
      <div className="flex-1 bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">Developer</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Joined Date</th>
                {/* Actions column only visible for Owners and Admins */}
                {(currentUserRole === 'Owner' || currentUserRole === 'Admin') && (
                  <th className="px-6 py-4 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-12 text-slate-400 italic">
                    No members found matching your search
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const isSelf = member.uid === currentUser?.uid;

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name/Email Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm border border-indigo-100/50">
                            {member.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 flex items-center gap-1.5 truncate max-w-[200px]" title={member.email}>
                              {member.email}
                              {isSelf && (
                                <span className="text-[10px] bg-slate-200/80 text-slate-600 font-bold px-1.5 py-0.5 rounded">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                              ID: {member.uid.substring(0, 10)}...
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role Column */}
                      <td className="px-6 py-4">
                        {/* 
                          Disable dropdown if:
                          - Updating own role (isSelf is true)
                          - Target user is an Owner (prevent demoting Owner)
                          - Logged-in user is just a 'Member'
                        */}
                        {isSelf || member.role === 'Owner' || currentUserRole === 'Member' ? (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRoleBadgeStyle(member.role)}`}>
                            <Shield className="w-3.5 h-3.5" />
                            {member.role || 'Member'}
                          </span>
                        ) : (
                          <select
                            value={member.role || 'Member'}
                            onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold px-2 py-1 text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer transition-all hover:bg-slate-100"
                          >
                            <option value="Member">Member</option>
                            <option value="Admin">Admin</option>
                            {/* Only the Owner can promote others to Owner */}
                            {currentUserRole === 'Owner' && (
                              <option value="Owner">Owner</option>
                            )}
                          </select>
                        )}
                      </td>

                      {/* Date Joined Column */}
                      <td className="px-6 py-4 text-slate-500 font-medium">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(member.joinedAt)}</span>
                        </div>
                      </td>

                      {/* Remove Actions Column - only for Owner/Admin */}
                      {(currentUserRole === 'Owner' || currentUserRole === 'Admin') && (
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleRemoveMember(member)}
                            disabled={isSelf || member.role === 'Owner'}
                            className={`p-2 rounded-lg transition-colors ${
                              isSelf || member.role === 'Owner'
                                ? 'text-slate-200 cursor-not-allowed opacity-40' 
                                : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                            }`}
                            title={
                              isSelf 
                                ? "You cannot remove yourself" 
                                : member.role === 'Owner' 
                                  ? "Workspace Owner cannot be removed" 
                                  : "Remove Member"
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simulated Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setIsInviteOpen(false)} />
          
          <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Invite Team Member</h3>
              </div>
              <button 
                onClick={() => setIsInviteOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              {inviteError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{inviteError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="developer@workspace.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Assign Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                >
                  <option value="Member">Member (View & edit tasks)</option>
                  <option value="Admin">Admin (Modify stages & invite members)</option>
                  {/* Only the Owner can invite a new Owner */}
                  {currentUserRole === 'Owner' && (
                    <option value="Owner">Owner (Full control)</option>
                  )}
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/10 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Inviting...' : 'Add to Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
