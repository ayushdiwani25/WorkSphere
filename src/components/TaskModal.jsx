import { useState, useEffect } from 'react';
import { X, Calendar, User, Flag, MessageSquare, Send, Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';

export default function TaskModal({ isOpen, onClose, onSave, initialData, stages, defaultStageId }) {
  const { user } = useAuth();
  
  // Task fields state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stageId, setStageId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');

  // Comment fields state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  
  // Real-time member profiles lookup
  const [userProfiles, setUserProfiles] = useState({});

  // 1. Sync task field states when modal loads
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setStageId(initialData.stageId || (stages[0]?.id || ''));
      setPriority(initialData.priority || 'medium');
      setAssignee(initialData.assignee || '');
      setDueDate(initialData.dueDate || '');
    } else {
      setTitle('');
      setDescription('');
      setStageId(defaultStageId || (stages[0]?.id || ''));
      setPriority('medium');
      setAssignee('');
      setDueDate('');
    }
    setError('');
  }, [initialData, isOpen, stages, defaultStageId]);

  // 2. Fetch comments in real-time for existing tasks
  useEffect(() => {
    if (!initialData?.id || !isOpen) {
      setComments([]);
      return;
    }

    const commentsQuery = query(collection(db, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Filter in-memory to prevent database composite index requirements
      const boardComments = list.filter(c => c.taskId === initialData.id);
      setComments(boardComments);
    });

    return unsubscribe;
  }, [initialData?.id, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const usersQuery = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const profiles = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.email) {
          profiles[data.email.toLowerCase()] = {
            displayName: data.displayName || data.email.split('@')[0],
            photoURL: data.photoURL || ''
          };
        }
      });
      setUserProfiles(profiles);
    });
    return unsubscribe;
  }, [isOpen]);

  if (!isOpen) return null;

  // Submit task changes
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }
    if (!stageId) {
      setError('A stage must be selected');
      return;
    }
    onSave({
      title: title.trim(),
      description: description.trim(),
      stageId,
      priority,
      assignee: assignee.trim(),
      dueDate,
    });
    onClose();
  };

  // Submit comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !user || !initialData?.id) return;

    const commentText = newComment.trim();
    setNewComment('');

    try {
      // Add comment document
      await addDoc(collection(db, 'comments'), {
        taskId: initialData.id,
        userEmail: user.email,
        text: commentText,
        createdAt: serverTimestamp()
      });

      // Log action in board activities
      await addDoc(collection(db, 'activities'), {
        boardId: initialData.boardId || '',
        userEmail: user.email,
        action: `commented on task '${initialData.title}'`,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this comment?')) return;
    try {
      await deleteDoc(doc(db, 'comments', commentId));
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  // Format comments relative time
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const now = new Date();
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const isEditMode = !!initialData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className={`relative w-full transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all border border-slate-100 flex flex-col md:flex-row gap-6 animate-in fade-in zoom-in-95 duration-200 ${
        isEditMode ? 'max-w-3xl' : 'max-w-lg'
      }`}>
        
        {/* Left Side: Task settings form */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-slate-800">
              {isEditMode ? 'Edit Task Details' : 'Create New Task'}
            </h3>
            {/* Header close button for single/create mode, hides on desktop for edit mode (moves to comment column header) */}
            <button 
              onClick={onClose}
              className={`text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg transition-colors ${
                isEditMode ? 'md:hidden' : ''
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Task Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
                autoFocus={!isEditMode}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add more details about this task..."
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Workflow Stage
                </label>
                <select
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                >
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5" /> Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Assignee Email
                </label>
                <input
                  type="email"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="e.g. name@domain.com"
                  className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/10 transition-colors"
              >
                {isEditMode ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Side: Comments feed - Displays ONLY when editing an existing task */}
        {isEditMode && (
          <div className="w-full md:w-80 pl-0 md:pl-6 border-t md:border-t-0 md:border-l border-slate-100 flex flex-col max-h-[420px] shrink-0">
            <div className="flex justify-between items-center mb-3 pt-4 md:pt-0 shrink-0">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comments ({comments.length})</h4>
              <button 
                onClick={onClose}
                className="hidden md:block text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Comments List scroll container */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 mb-4 scrollbar-thin">
              {comments.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic text-center py-8">
                  No discussion comments. Add a comment to notify the team.
                </div>
              ) : (
                comments.map((comment) => {
                  const isCommentOwner = comment.userEmail === user?.email;
                  const profile = userProfiles[comment.userEmail?.toLowerCase()] || {
                    displayName: comment.userEmail?.split('@')[0],
                    photoURL: ''
                  };
                  return (
                    <div key={comment.id} className="flex gap-2.5 text-xs group">
                      <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px] border border-indigo-100/50 shrink-0 overflow-hidden">
                        {profile.photoURL ? (
                          <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          profile.displayName?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-800 truncate max-w-[120px]" title={comment.userEmail}>
                            {profile.displayName}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium shrink-0">
                            {formatRelativeTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-slate-600 mt-0.5 leading-relaxed break-words">{comment.text}</p>
                      </div>
                      {isCommentOwner && (
                        <button
                          onClick={(e) => handleDeleteComment(comment.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-opacity shrink-0"
                          title="Delete Comment"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Comment Form input */}
            <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t border-slate-100 shrink-0">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
              />
              <button
                type="submit"
                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md shadow-indigo-600/10 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
