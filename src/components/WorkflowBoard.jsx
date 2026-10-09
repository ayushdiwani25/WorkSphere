import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import {
  Plus, Trash2, Edit2, Calendar, User, PlusCircle, Workflow, History, X,
  BarChart2, PieChart, TrendingUp, CheckCircle2, AlertTriangle, Layers, Lock
} from 'lucide-react';
import StageModal from './StageModal';
import TaskModal from './TaskModal';

export default function WorkflowBoard() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [stages, setStages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [availableBoards, setAvailableBoards] = useState([]);
  const [loadingBoards, setLoadingBoards] = useState(true);

  // Real-time member profiles lookup
  const [userProfiles, setUserProfiles] = useState({});

  // View toggle state: 'board' or 'analytics'
  const [activeView, setActiveView] = useState('board');

  // Modals and Drawer state
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState(null);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [defaultStageIdForNewTask, setDefaultStageIdForNewTask] = useState('');

  const [isActivityOpen, setIsActivityOpen] = useState(false);

  // Drag & Drop state
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverStageId, setDragOverStageId] = useState(null);

  // Sync active user profile dynamics
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUserProfile(docSnap.data());
      }
    });
    return unsubscribe;
  }, [user]);

  // Auto-seeding function for a new board
  const seedDefaultStages = async (activeId) => {
    try {
      const batch = writeBatch(db);
      const defaultStages = ['To Do', 'In Progress', 'Done'];

      defaultStages.forEach((name, index) => {
        const docRef = doc(collection(db, 'stages'));
        batch.set(docRef, {
          name,
          order: index,
          boardId: activeId,
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();
    } catch (err) {
      console.error('Error seeding default stages:', err);
    }
  };

  // 1. Listen for available boards to handle index redirection
  useEffect(() => {
    if (!user) return;
    const boardsQuery = query(collection(db, 'boards'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(boardsQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvailableBoards(list);
      setLoadingBoards(false);
    });
    return unsubscribe;
  }, [user]);

  // Real-time profiles listener
  useEffect(() => {
    if (!user) return;
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
  }, [user]);

  // 2. Redirect / to the first available board if exists
  useEffect(() => {
    if (!boardId && !loadingBoards && availableBoards.length > 0) {
      navigate(`/dashboard/board/${availableBoards[0].id}`, { replace: true });
    }
  }, [boardId, availableBoards, loadingBoards, navigate]);

  // 3. Listen for stages of the active board
  useEffect(() => {
    if (!boardId) {
      setStages([]);
      return;
    }

    const stagesQuery = query(collection(db, 'stages'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(stagesQuery, (snapshot) => {
      const fetchedStages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const boardStages = fetchedStages.filter(s => s.boardId === boardId);

      // Auto-seed stages if this board is empty
      if (boardStages.length === 0) {
        seedDefaultStages(boardId);
      } else {
        setStages(boardStages);
      }
    });

    return unsubscribe;
  }, [boardId]);

  // 4. Listen for tasks of the active board
  useEffect(() => {
    if (!boardId) {
      setTasks([]);
      return;
    }

    const tasksQuery = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const boardTasks = fetchedTasks.filter(t => t.boardId === boardId);
      setTasks(boardTasks);
    });

    return unsubscribe;
  }, [boardId]);

  // 5. Listen for activities of the active board
  useEffect(() => {
    if (!boardId) {
      setActivities([]);
      return;
    }

    // Fetch all activities ordered by timestamp, filter in-memory to prevent composite index requirements
    const activitiesQuery = query(collection(db, 'activities'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const boardActivities = list.filter(a => a.boardId === boardId).slice(0, 50);
      setActivities(boardActivities);
    });

    return unsubscribe;
  }, [boardId]);

  // Reusable activity logger
  const logActivity = async (actionText) => {
    if (!boardId || !user) return;
    try {
      await addDoc(collection(db, 'activities'), {
        boardId,
        userEmail: user.email,
        action: actionText,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error logging activity:", err);
    }
  };

  // Create First Board landing logic
  const handleCreateFirstBoard = async () => {
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

  // Stage Handlers
  const handleOpenAddStage = () => {
    setEditingStage(null);
    setIsStageModalOpen(true);
  };

  const handleOpenEditStage = (stage, e) => {
    e.stopPropagation();
    setEditingStage(stage);
    setIsStageModalOpen(true);
  };

  const handleSaveStage = async (name) => {
    try {
      if (editingStage) {
        await updateDoc(doc(db, 'stages', editingStage.id), { name });
        logActivity(`renamed stage from '${editingStage.name}' to '${name}'`);
      } else {
        const order = stages.length > 0 ? stages[stages.length - 1].order + 1 : 0;
        await addDoc(collection(db, 'stages'), {
          name,
          order,
          boardId,
          createdAt: serverTimestamp()
        });
        logActivity(`created stage '${name}'`);
      }
    } catch (err) {
      console.error('Error saving stage:', err);
    }
  };

  const handleDeleteStage = async (stageId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this stage and all its tasks?')) return;

    const stageName = stages.find(s => s.id === stageId)?.name || 'Unknown Stage';
    try {
      const tasksInStage = tasks.filter(t => t.stageId === stageId);
      const batch = writeBatch(db);

      tasksInStage.forEach((task) => {
        batch.delete(doc(db, 'tasks', task.id));
      });

      batch.delete(doc(db, 'stages', stageId));
      await batch.commit();
      logActivity(`deleted stage '${stageName}'`);
    } catch (err) {
      console.error('Error deleting stage:', err);
    }
  };

  // Task Handlers
  const handleOpenAddTask = (stageId) => {
    setEditingTask(null);
    setDefaultStageIdForNewTask(stageId);
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTask = (task, e) => {
    e.stopPropagation();
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async (taskData) => {
    try {
      if (editingTask) {
        await updateDoc(doc(db, 'tasks', editingTask.id), taskData);
        logActivity(`updated details for task '${taskData.title}'`);
      } else {
        await addDoc(collection(db, 'tasks'), {
          ...taskData,
          boardId,
          createdAt: serverTimestamp()
        });
        logActivity(`created task '${taskData.title}'`);
      }
    } catch (err) {
      console.error('Error saving task:', err);
    }
  };

  const handleDeleteTask = async (taskId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this task?')) return;

    const taskTitle = tasks.find(t => t.id === taskId)?.title || 'Unknown Task';
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      logActivity(`deleted task '${taskTitle}'`);
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverStageId(null);
  };

  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleDrop = async (e, targetStageId) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    const targetStage = stages.find(s => s.id === targetStageId);
    if (!task || !targetStage) return;

    // Do nothing if dropping in same stage
    if (task.stageId === targetStageId) {
      handleDragEnd();
      return;
    }

    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        stageId: targetStageId
      });
      logActivity(`moved task '${task.title}' to '${targetStage.name}'`);
    } catch (err) {
      console.error('Error updating task stage on drop:', err);
    } finally {
      handleDragEnd();
    }
  };

  // Color helper for priority badges
  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-rose-50 text-rose-600 border-rose-100/50';
      case 'medium':
        return 'bg-amber-50 text-amber-600 border-amber-100/50';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  // Relative Time Formatter
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

  if (loadingBoards) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm bg-slate-50/50">
        Loading workspace boards...
      </div>
    );
  }

  // Welcome page if no board matches URL and no boards exist
  if (!boardId && availableBoards.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50/50">
        <div className="w-full max-w-lg bg-white border border-slate-200/80 p-10 rounded-3xl shadow-xl text-center">
          <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-6">
            <Workflow className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight mb-3">Welcome to Workflow Management</h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed max-w-md mx-auto">
            To get started collaborating in real-time, create your first project board. You will be able to manage task columns and details immediately.
          </p>
          <button
            onClick={handleCreateFirstBoard}
            className="inline-flex items-center gap-2.5 px-6 py-3 font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            <span>Create Your First Board</span>
          </button>
        </div>
      </div>
    );
  }

  const activeBoard = availableBoards.find(b => b.id === boardId);
  const boardName = activeBoard ? activeBoard.name : 'Workflow Board';

  // 6. Analytics calculations
  const totalTasksCount = tasks.length;
  const lastStage = stages[stages.length - 1];
  const completedTasksCount = lastStage
    ? tasks.filter(t => t.stageId === lastStage.id).length
    : 0;

  const highPriorityCount = tasks.filter(t => t.priority === 'high').length;
  const mediumPriorityCount = tasks.filter(t => t.priority === 'medium').length;
  const lowPriorityCount = tasks.filter(t => t.priority === 'low').length;

  const assigneeWorkloads = {};
  tasks.forEach(task => {
    if (task.assignee) {
      assigneeWorkloads[task.assignee] = (assigneeWorkloads[task.assignee] || 0) + 1;
    }
  });
  const assigneesList = Object.keys(assigneeWorkloads).map(email => ({
    email,
    count: assigneeWorkloads[email]
  }));

  return (
    <div className="p-8 h-[calc(100vh-4rem)] flex flex-col">
      {/* Upper Control Bar */}
      <div className="flex justify-between items-center mb-4 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{boardName}</h2>
          <p className="text-xs text-slate-400">Drag and drop cards to update task statuses instantly</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsActivityOpen(!isActivityOpen)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 transition-all ${isActivityOpen
              ? "bg-slate-800 border-slate-800 text-white shadow-md"
              : "bg-white hover:bg-slate-50 text-slate-600 hover:border-slate-300"
              }`}
          >
            <History className="w-4 h-4" />
            <span>Activity History</span>
          </button>
          {activeView === 'board' && (
            <button
              onClick={handleOpenAddStage}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/10 transition-all hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Stage</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub Header View Toggle Tabs */}
      <div className="flex gap-4 border-b border-slate-200 mb-6 shrink-0 text-sm">
        <button
          onClick={() => setActiveView('board')}
          className={`flex items-center gap-2 pb-2.5 font-semibold transition-all border-b-2 ${activeView === 'board'
            ? 'border-indigo-600 text-indigo-600'
            : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
        >
          <Layers className="w-4 h-4" />
          <span>Board View</span>
        </button>
        <button
          onClick={() => setActiveView('analytics')}
          className={`flex items-center gap-2 pb-2.5 font-semibold transition-all border-b-2 ${activeView === 'analytics'
            ? 'border-indigo-600 text-indigo-600'
            : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Project Analytics</span>
        </button>
      </div>

      {/* Main Content Area */}
      {activeView === 'analytics' ? (
        currentUserProfile?.tier !== 'pro' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-3xl relative overflow-hidden text-center min-h-[450px]">
            {/* Ambient Glowing Background lights */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none"></div>

            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 mb-4 relative z-10 shrink-0">
              <Lock className="w-8 h-8 animate-pulse" />
            </div>

            <h3 className="text-xl font-extrabold text-white tracking-tight relative z-10">Project Analytics is Locked</h3>
            <p className="text-slate-400 text-sm max-w-sm mt-2 mb-6 relative z-10 leading-relaxed">
              Upgrade your workspace to Pro to unlock real-time priority gauges, assignee workloads, and stage loads.
            </p>

            <button
              onClick={() => {
                window.dispatchEvent(new Event('open-checkout'));
              }}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/20 hover:-translate-y-0.5 relative z-10"
            >
              Upgrade Workspace Now
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 pr-1 pb-4">

            {/* KPI Statistics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {/* Card 1: Total Tasks */}
              <div className="bg-white border border-slate-200/85 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-indigo-50 border border-indigo-100/50 rounded-xl text-indigo-600 shrink-0">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tasks</p>
                  <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalTasksCount}</h3>
                </div>
              </div>

              {/* Card 2: Completed Tasks */}
              <div className="bg-white border border-slate-200/85 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 border border-emerald-100/50 rounded-xl text-emerald-600 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed Tasks</p>
                  <h3 className="text-2xl font-bold text-slate-800 mt-1">{completedTasksCount}</h3>
                </div>
              </div>

              {/* Card 3: Active Stages */}
              <div className="bg-white border border-slate-200/85 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-50 border border-blue-100/50 rounded-xl text-blue-600 shrink-0">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Stages</p>
                  <h3 className="text-2xl font-bold text-slate-800 mt-1">{stages.length}</h3>
                </div>
              </div>

              {/* Card 4: Urgent High Priority */}
              <div className="bg-white border border-slate-200/85 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                <div className={`p-3 rounded-xl shrink-0 border ${highPriorityCount > 0
                  ? 'bg-rose-50 border-rose-100/50 text-rose-600 animate-pulse'
                  : 'bg-slate-50 border-slate-100 text-slate-500'
                  }`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">High Priority</p>
                  <h3 className="text-2xl font-bold text-slate-800 mt-1">{highPriorityCount}</h3>
                </div>
              </div>
            </div>

            {/* Graphical Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Chart Column 1: Stage Task Distribution */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col min-h-[300px]">
                <div className="flex items-center gap-2 mb-5 shrink-0">
                  <BarChart2 className="w-4 h-4 text-slate-500" />
                  <h4 className="text-sm font-bold text-slate-800">Workflow Stage Loads</h4>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {stages.map(stage => {
                    const stageTasks = tasks.filter(t => t.stageId === stage.id);
                    const percentage = totalTasksCount > 0
                      ? Math.round((stageTasks.length / totalTasksCount) * 100)
                      : 0;

                    return (
                      <div key={stage.id} className="space-y-1.5 text-xs">
                        <div className="flex justify-between font-semibold text-slate-700">
                          <span>{stage.name}</span>
                          <span className="text-slate-400">{stageTasks.length} tasks ({percentage}%)</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/20">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chart Column 2: Priorities Distribution */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col min-h-[300px]">
                <div className="flex items-center gap-2 mb-5 shrink-0">
                  <PieChart className="w-4 h-4 text-slate-500" />
                  <h4 className="text-sm font-bold text-slate-800">Task Priorities</h4>
                </div>

                <div className="flex-1 flex flex-col justify-center space-y-4">
                  {/* Gauge 1: High */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        High Priority
                      </span>
                      <span className="text-rose-600 font-bold">{highPriorityCount} tasks</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full transition-all duration-500"
                        style={{ width: `${totalTasksCount > 0 ? (highPriorityCount / totalTasksCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Gauge 2: Medium */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Medium Priority
                      </span>
                      <span className="text-amber-600 font-bold">{mediumPriorityCount} tasks</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${totalTasksCount > 0 ? (mediumPriorityCount / totalTasksCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Gauge 3: Low */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        Low Priority
                      </span>
                      <span className="text-slate-500 font-bold">{lowPriorityCount} tasks</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-400 rounded-full transition-all duration-500"
                        style={{ width: `${totalTasksCount > 0 ? (lowPriorityCount / totalTasksCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2 Chart: Developer Workloads */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:col-span-2 min-h-[220px]">
                <div className="flex items-center gap-2 mb-5 shrink-0">
                  <User className="w-4 h-4 text-slate-500" />
                  <h4 className="text-sm font-bold text-slate-800">Developer Task Assignment Workloads</h4>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {assigneesList.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 italic py-6">
                      No tasks are assigned to developers yet. Edit tasks to assign them.
                    </div>
                  ) : (
                    assigneesList.map(assignee => {
                      const percentage = totalTasksCount > 0
                        ? Math.round((assignee.count / totalTasksCount) * 100)
                        : 0;

                      return (
                        <div key={assignee.email} className="space-y-1 text-xs">
                          <div className="flex justify-between font-semibold text-slate-700">
                            <span className="font-semibold text-slate-800">{assignee.email}</span>
                            <span className="text-slate-400">{assignee.count} tasks ({percentage}%)</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

          </div>
        )
      ) : (
        /* Main Board View & Drawer Layout */
        <div className="flex-1 flex gap-6 overflow-hidden select-none">

          {/* Workflow Stage Columns Grid */}
          <div className="flex-1 flex gap-6 overflow-x-auto pb-4 items-start">
            {stages.map((stage) => {
              const stageTasks = tasks.filter(task => task.stageId === stage.id);
              const isOver = dragOverStageId === stage.id;

              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => handleDragOver(e, stage.id)}
                  onDragLeave={() => setDragOverStageId(null)}
                  onDrop={(e) => handleDrop(e, stage.id)}
                  className={`w-80 shrink-0 bg-slate-100/50 rounded-2xl border border-slate-200/60 p-4 flex flex-col max-h-full transition-all duration-200 ${isOver ? 'bg-indigo-50/50 border-indigo-200 ring-2 ring-indigo-500/5 shadow-inner' : ''
                    }`}
                >
                  {/* Stage Header */}
                  <div className="flex justify-between items-center mb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{stage.name}</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-200/80 text-slate-600 rounded-full">
                        {stageTasks.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleOpenEditStage(stage, e)}
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded transition-colors"
                        title="Rename Stage"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteStage(stage.id, e)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Delete Stage"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Add Task Quick Button */}
                  <button
                    onClick={() => handleOpenAddTask(stage.id)}
                    className="w-full mb-3 py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 bg-white hover:bg-slate-50 rounded-xl border border-dashed border-slate-200 hover:border-indigo-200 transition-all shadow-sm"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Create Task</span>
                  </button>

                  {/* Stage Tasks List */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                    {stageTasks.length === 0 ? (
                      <div className="h-24 border-2 border-dashed border-slate-200/40 rounded-xl flex items-center justify-center text-[11px] text-slate-400 italic">
                        No active tasks
                      </div>
                    ) : (
                      stageTasks.map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => handleOpenEditTask(task, e)}
                          className={`group relative bg-white border border-slate-100 hover:border-indigo-100 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing hover:-translate-y-0.5 ${draggedTaskId === task.id ? 'opacity-40 border-dashed border-indigo-300' : ''
                            }`}
                        >
                          {/* Priority Tag & Actions */}
                          <div className="flex justify-between items-start mb-2">
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getPriorityStyle(task.priority)}`}>
                              {task.priority}
                            </span>
                            <button
                              onClick={(e) => handleDeleteTask(task.id, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-opacity transition-colors"
                              title="Delete Task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Title & Description */}
                          <h4 className="text-xs font-bold text-slate-800 mb-1 leading-snug group-hover:text-indigo-600 transition-colors">
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                              {task.description}
                            </p>
                          )}

                          {/* Footer: Date & Assignee */}
                          {(task.dueDate || task.assignee) && (
                            <div className="flex items-center justify-between border-t border-slate-50 pt-2.5 mt-2.5 text-[10px] text-slate-400">
                              {task.dueDate ? (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  <span>{task.dueDate}</span>
                                </span>
                              ) : <span />}

                              {task.assignee && (() => {
                                const assigneeProfile = userProfiles[task.assignee.toLowerCase()] || {
                                  displayName: task.assignee.split('@')[0],
                                  photoURL: ''
                                };
                                return (
                                  <span className="flex items-center gap-1.5 font-medium bg-slate-50 border border-slate-100 pl-1 pr-2 py-0.5 rounded-md text-slate-600 max-w-[120px] truncate" title={task.assignee}>
                                    <div className="w-4 h-4 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[8px] overflow-hidden shrink-0">
                                      {assigneeProfile.photoURL ? (
                                        <img src={assigneeProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                                      ) : (
                                        assigneeProfile.displayName?.charAt(0).toUpperCase()
                                      )}
                                    </div>
                                    <span className="truncate">{assigneeProfile.displayName}</span>
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Slide-out Activity Log Panel */}
          {isActivityOpen && (
            <div className="w-80 shrink-0 bg-white border border-slate-200 rounded-2xl flex flex-col h-full shadow-lg overflow-hidden animate-in slide-in-from-right duration-200">
              {/* Panel Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-bold text-slate-800">Activity History</span>
                </div>
                <button
                  onClick={() => setIsActivityOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* List of activities */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activities.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 italic text-center p-4">
                    No activities recorded yet. Actions like adding tasks or moving columns will display here.
                  </div>
                ) : (
                  activities.map((activity) => {
                    const profile = userProfiles[activity.userEmail?.toLowerCase()] || {
                      displayName: activity.userEmail?.split('@')[0],
                      photoURL: ''
                    };
                    return (
                      <div key={activity.id} className="flex gap-3 text-xs leading-normal">
                        {/* Avatar bubble */}
                        <div className="w-6.5 h-6.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100/50 flex items-center justify-center font-bold text-[10px] shrink-0 overflow-hidden">
                          {profile.photoURL ? (
                            <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            profile.displayName?.charAt(0).toUpperCase() || 'U'
                          )}
                        </div>
                        {/* Log details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-700">
                            <span className="font-semibold text-slate-800">{profile.displayName}</span>{' '}
                            {activity.action}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                            {formatRelativeTime(activity.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <StageModal
        isOpen={isStageModalOpen}
        onClose={() => setIsStageModalOpen(false)}
        onSave={handleSaveStage}
        initialData={editingStage}
      />

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        initialData={editingTask}
        stages={stages}
        defaultStageId={defaultStageIdForNewTask}
      />
    </div>
  );
}
