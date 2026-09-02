import React, { useState } from 'react';
import { Student } from '../types';
import { getTagStyle } from '../utils/tagColors';
import { Trash2, Plus, X, Tag as TagIcon, GraduationCap, Hash, Check } from 'lucide-react';

interface StudentCardProps {
  student: Student;
  onRemoveTag: (studentId: string, tagToRemove: string) => void;
  onAddTag: (studentId: string, newTag: string) => void;
  onDeleteStudent: (studentId: string) => void;
  activeFilterTags: string[];
  onTagClick: (tag: string) => void;
}

export const StudentCard: React.FC<StudentCardProps> = ({
  student,
  onRemoveTag,
  onAddTag,
  onDeleteStudent,
  activeFilterTags,
  onTagClick,
}) => {
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagInput.trim();
    if (trimmed && !student.tags.includes(trimmed)) {
      onAddTag(student.id, trimmed);
      setNewTagInput('');
      setIsAddingTag(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const isMale = student.gender === 'Male';

  return (
    <div
      id={`student-card-${student.id}`}
      className="bg-white border border-neutral-200 hover:border-neutral-900 transition-all duration-200 rounded-lg p-5 flex flex-col justify-between shadow-[1px_1px_0px_rgba(0,0,0,0.05)] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)]"
    >
      {/* Upper info section */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-3">
            {/* Student avatar */}
            {student.avatar ? (
              <div className="w-11 h-11 rounded border border-neutral-300 overflow-hidden shrink-0 shadow-sm bg-neutral-50">
                <img
                  src={student.avatar}
                  alt={student.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="w-11 h-11 rounded border border-neutral-300 bg-neutral-100 flex items-center justify-center shrink-0">
                <span className="font-mono font-bold text-xs text-neutral-600">
                  {getInitials(student.name)}
                </span>
              </div>
            )}

            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-sm text-neutral-900 tracking-tight leading-snug">
                  {student.name}
                </h3>
                <span
                  title={`Gender: ${student.gender}`}
                  className="inline-flex items-center justify-center text-[9px] px-1 bg-neutral-100 border border-neutral-200 text-neutral-600 rounded font-mono font-bold"
                >
                  {isMale ? '♂ M' : '♀ F'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-mono text-neutral-500">
                <span className="inline-flex items-center gap-0.5 text-neutral-900 font-semibold">
                  <Hash className="w-3 h-3" />
                  {student.rollNumber}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-0.5">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {student.grade}
                </span>
              </div>
            </div>
          </div>

          <button
            id={`btn-delete-${student.id}`}
            onClick={() => onDeleteStudent(student.id)}
            title="Remove Student"
            className="text-neutral-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Optional notes notes */}
        {student.notes && (
          <p className="text-xs text-neutral-500 italic mb-3 pl-1.5 border-l-2 border-neutral-300">
            "{student.notes}"
          </p>
        )}
      </div>

      {/* Classroom Seating Tags section */}
      <div className="mt-2.5 pt-2.5 border-t border-neutral-100">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
            <TagIcon className="w-3 h-3" />
            Classroom Tags
          </span>

          {!isAddingTag && (
            <button
              id={`btn-add-tag-trigger-${student.id}`}
              onClick={() => setIsAddingTag(true)}
              className="text-[10px] font-bold text-neutral-900 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          )}
        </div>

        {/* Tags badges rendering */}
        <div className="flex flex-wrap gap-1 min-h-[25px] items-center">
          {student.tags.length === 0 ? (
            <span className="text-xs text-neutral-400 italic font-mono">No tags assigned</span>
          ) : (
            student.tags.map((tag) => {
              const style = getTagStyle(tag);
              const isFiltered = activeFilterTags.includes(tag);
              return (
                <span
                  key={tag}
                  id={`tag-badge-${student.id}-${tag.replace(/\s+/g, '-').toLowerCase()}`}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border transition-all ${style.bg} ${style.text} ${style.border} ${
                    isFiltered ? 'ring-1 ring-neutral-950 font-bold' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onTagClick(tag)}
                    className="hover:underline cursor-pointer flex items-center gap-1 text-left"
                    title={`Filter by tag: ${tag}`}
                  >
                    <span>{tag}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTag(student.id, tag);
                    }}
                    className="ml-0.5 opacity-60 hover:opacity-100 hover:text-red-600 rounded transition-opacity p-0.5"
                    title={`Remove tag "${tag}"`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })
          )}
        </div>

        {/* Inline tag editor input */}
        {isAddingTag && (
          <form onSubmit={handleAddCustomTag} className="mt-2 flex items-center gap-1.5">
            <input
              type="text"
              id={`input-card-newtag-${student.id}`}
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              placeholder="Tag name..."
              autoFocus
              className="flex-1 bg-white border border-neutral-900 rounded px-2 py-0.5 text-xs text-neutral-950 placeholder-neutral-400 focus:outline-none font-sans"
            />
            <button
              type="submit"
              id={`btn-card-save-tag-${student.id}`}
              disabled={!newTagInput.trim()}
              className="bg-neutral-900 disabled:opacity-50 text-white p-1 rounded transition-colors"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              id={`btn-card-cancel-tag-${student.id}`}
              onClick={() => {
                setIsAddingTag(false);
                setNewTagInput('');
              }}
              className="bg-neutral-100 text-neutral-500 hover:bg-neutral-200 p-1 rounded transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
