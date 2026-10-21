import { useState, useEffect, useMemo } from 'react';
import { Tag } from '@/types';
import { fetchUserTags, createTag } from '@/lib/api';
import { TagBadge } from './TagBadge';
import { Plus, Check, ChevronDown, ChevronRight, X, PaintBucket, Tag as TagIcon } from 'lucide-react';

interface TagSelectorProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  teamId?: string | null;
}

const PRESET_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#64748b', '#22c55e', '#a855f7'
];

export function TagSelector({ selectedTagIds, onChange, teamId }: TagSelectorProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [newTagParentId, setNewTagParentId] = useState<string | null>(null);

  const loadTags = async () => {
    const tags = teamId ? await fetchUserTags(teamId) : [];
    setAllTags(tags);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al montar o cambiar de equipo
    loadTags();
  }, [teamId]); // Re-load when team changes

  const selectedTags = useMemo(() => 
    allTags.filter(t => selectedTagIds.includes(t.id)), 
  [allTags, selectedTagIds]);

  const filteredTags = useMemo(() => 
    allTags.filter(t => t.name.toLowerCase().includes(search.toLowerCase())), 
  [allTags, search]);

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    const tag = await createTag(newTagName.trim(), newTagColor, newTagParentId, teamId || null);
    if (tag) {
      setAllTags(prev => [...prev, tag]);
      onChange([...selectedTagIds, tag.id]);
      setNewTagName('');
      setIsCreating(false);
      setNewTagParentId(null);
    }
  };

  // Helper to render hierarchical tags
  const renderTagItem = (tag: Tag, depth = 0) => {
    const isSelected = selectedTagIds.includes(tag.id);
    const children = allTags.filter(t => t.parent_id === tag.id);

    return (
      <div key={tag.id} className="flex flex-col">
        <div 
          className={`group flex items-center justify-between px-3 py-2 hover:bg-surface-container-high cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => handleToggleTag(tag.id)}
        >
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
            <span className={`text-sm ${isSelected ? 'text-primary font-medium' : 'text-on-surface'}`}>{tag.name}</span>
          </div>
          {isSelected && <Check className="w-4 h-4 text-primary" />}
        </div>
        {children.map(child => renderTagItem(child, depth + 1))}
      </div>
    );
  };

  const rootTags = useMemo(() => allTags.filter(t => !t.parent_id), [allTags]);

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {selectedTags.map(tag => (
          <TagBadge key={tag.id} tag={tag} onRemove={() => handleToggleTag(tag.id)} />
        ))}
        <button 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:border-primary/50 transition-all shadow-sm"
        >
          <Plus className="w-3 h-3" />
          Add Tag
        </button>
      </div>

      {isDropdownOpen && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[240px] max-h-[420px] bg-surface-container-highest border border-outline-variant/20 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.4)] z-50 overflow-y-auto flex flex-col backdrop-blur-md">
          {isCreating ? (
            <div className="p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
               <div className="flex items-center justify-between">
                 <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Create New Tag</h4>
                 <button onClick={() => setIsCreating(false)}><X className="w-4 h-4 text-on-surface-variant" /></button>
               </div>
               
               <div className="flex flex-col gap-3">
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Tag name..." 
                    className="bg-surface-container border border-outline-variant/30 text-on-surface text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                  />

                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Select Color</span>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.map(color => (
                        <button 
                          key={color}
                          onClick={() => setNewTagColor(color)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform ${newTagColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Parent Tag (Optional)</span>
                    <select 
                       className="bg-surface-container border border-outline-variant/30 text-on-surface text-xs rounded-lg px-3 py-2 outline-none focus:border-primary"
                       value={newTagParentId || ''}
                       onChange={(e) => setNewTagParentId(e.target.value || null)}
                    >
                       <option value="">None (Top level)</option>
                       {allTags.map(t => (
                         <option key={t.id} value={t.id}>{t.name}</option>
                       ))}
                    </select>
                  </div>

                  <button 
                    disabled={!newTagName.trim()}
                    onClick={handleCreateTag}
                    className="w-full mt-2 bg-primary text-black py-2 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all disabled:opacity-50"
                  >
                    Create Tag
                  </button>
               </div>
            </div>
          ) : (
            <>
              <div className="p-2 border-b border-outline-variant/10">
                <input 
                  type="text" 
                  placeholder="Search tags..." 
                  className="w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary transition-all"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {rootTags.length > 0 ? (
                  rootTags.filter(t => t.name.toLowerCase().includes(search.toLowerCase())).map(t => renderTagItem(t))
                ) : (
                  <div className="p-8 text-center flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                      <TagIcon className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col gap-1">
                       <p className="text-sm font-bold text-on-surface">No hay categorías aún</p>
                       <p className="text-[10px] text-on-surface-variant max-w-[180px] mx-auto text-balance leading-relaxed tracking-wide">Crea una categoría para organizar tus tareas por temas, prioridad o departamentos.</p>
                    </div>
                    <button 
                      onClick={() => setIsCreating(true)}
                      className="mt-2 px-4 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-black transition-all"
                    >
                      Crear Primera Categoría
                    </button>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setIsCreating(true)}
                className="p-3 border-t border-outline-variant/10 text-xs font-bold text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Tag
              </button>
            </>
          )}
        </div>
      )}
      
      {isDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />}
    </div>
  );
}
