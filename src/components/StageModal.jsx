import { useState, useEffect } from 'react';
import { X, Plus, Edit2 } from 'lucide-react';

export default function StageModal({ isOpen, onClose, onSave, initialData }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
    } else {
      setName('');
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Stage name is required');
      return;
    }
    onSave(name.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              {initialData ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {initialData ? 'Rename Stage' : 'Create New Stage'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Stage Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. In Progress, Review, QA"
              className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
              autoFocus
            />
            {error && (
              <p className="mt-1.5 text-xs font-medium text-red-500">
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/10 transition-colors"
            >
              {initialData ? 'Save Changes' : 'Create Stage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
