import React, { useState } from 'react';
import { Student } from '../types';
import { getTagStyle } from '../utils/tagColors';
import { UserPlus, Plus, X, Sparkles, Image as ImageIcon, Trash2, Camera } from 'lucide-react';

interface AddStudentFormProps {
  onAddStudent: (newStudent: Omit<Student, 'id'>) => void;
  allAvailableTags: string[];
}

export const AddStudentForm: React.FC<AddStudentFormProps> = ({
  onAddStudent,
  allAvailableTags,
}) => {
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [grade, setGrade] = useState('Grade 10-A');
  const [notes, setNotes] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [avatar, setAvatar] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Suggested tags
  const defaultSuggestedTags = [
    'Needs Front Row',
    'High Performer',
    'Talkative',
    'Eye Strain',
    'Quiet Learner',
    'Peer Tutor',
    'Easily Distracted'
  ];
  const suggestedTags = Array.from(new Set([...defaultSuggestedTags, ...allAvailableTags]));

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddCustomTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    if (!selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed]);
    }
    setCustomTagInput('');
  };

  const handleKeyDownCustomTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustomTag();
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) {
      setErrorMsg('Profile picture must be under 500KB. Try a smaller or cropped image.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatar(reader.result as string);
      setErrorMsg('');
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatar('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter student full name.');
      return;
    }
    if (!rollNumber.trim()) {
      setErrorMsg('Please provide a roll number (e.g., R-109).');
      return;
    }

    setErrorMsg('');
    onAddStudent({
      name: name.trim(),
      rollNumber: rollNumber.trim(),
      grade: grade.trim() || 'Grade 10-A',
      tags: selectedTags,
      notes: notes.trim() || undefined,
      gender,
      avatar: avatar || undefined,
      joinedDate: new Date().toISOString().split('T')[0],
    });

    setName('');
    setRollNumber('');
    setNotes('');
    setGender('Male');
    setAvatar('');
    setSelectedTags([]);
    setCustomTagInput('');
    setIsOpen(false);
  };

  return (
    <div className="bg-white border border-neutral-900 rounded-lg p-6 shadow-[2px_2px_0px_rgba(0,0,0,1)] relative">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-neutral-900 flex items-center justify-center text-white">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-950 tracking-tight">
              Enroll Student Profile
            </h2>
            <p className="text-xs text-neutral-500">
              Enter details, assign seating criteria, and upload profile photo.
            </p>
          </div>
        </div>

        <button
          id="btn-toggle-add-form"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-semibold rounded border border-neutral-950 transition-colors flex items-center gap-2 cursor-pointer"
        >
          {isOpen ? (
            <>
              <X className="w-3.5 h-3.5" /> Close Panel
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" /> Expand Quick Form
            </>
          )}
        </button>
      </div>

      {/* Form Fields container */}
      <form onSubmit={handleSubmit} className={`mt-5 space-y-5 ${isOpen ? 'block' : 'hidden sm:block'}`}>
        {errorMsg && (
          <div className="p-3 rounded bg-red-50 border border-red-900 text-red-900 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar Picture Input Slot */}
          <div className="flex flex-col items-center justify-center bg-neutral-50 border border-neutral-200 rounded p-4 w-full md:w-40 shrink-0">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2.5">
              Profile Photo
            </span>
            <div className="relative group w-24 h-24 rounded border border-neutral-950 bg-white flex items-center justify-center overflow-hidden shadow-inner">
              {avatar ? (
                <img
                  src={avatar}
                  alt="Avatar Preview"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-center text-neutral-400 flex flex-col items-center gap-1">
                  <Camera className="w-6 h-6" />
                  <span className="text-[9px] uppercase tracking-wide">Select</span>
                </div>
              )}

              {/* Upload Input overlay */}
              <label
                htmlFor="avatar-upload-input"
                className="absolute inset-0 bg-neutral-950/80 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-[10px] font-bold text-center"
              >
                <ImageIcon className="w-4 h-4 mb-1" />
                Upload File
              </label>
              <input
                id="avatar-upload-input"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            {avatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="mt-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-neutral-100 text-neutral-600 hover:text-red-600 border border-neutral-200 hover:border-red-200 text-[9px] transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {/* Details form inputs */}
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="input-student-name" className="block text-xs font-bold text-neutral-900 mb-1.5 uppercase tracking-wide">
                  Full Name *
                </label>
                <input
                  id="input-student-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Julian Thorne"
                  className="w-full bg-white border border-neutral-950 rounded px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label htmlFor="input-roll-number" className="block text-xs font-bold text-neutral-900 mb-1.5 uppercase tracking-wide">
                  Roll / ID Number *
                </label>
                <input
                  id="input-roll-number"
                  type="text"
                  required
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="R-109"
                  className="w-full bg-white border border-neutral-950 rounded px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label htmlFor="select-grade" className="block text-xs font-bold text-neutral-900 mb-1.5 uppercase tracking-wide">
                  Grade / Section
                </label>
                <select
                  id="select-grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full bg-white border border-neutral-950 rounded px-3 py-2 text-xs text-neutral-900 focus:outline-none cursor-pointer"
                >
                  <option value="Grade 10-A">Grade 10-A</option>
                  <option value="Grade 10-B">Grade 10-B</option>
                  <option value="Grade 11-A">Grade 11-A</option>
                  <option value="Grade 11-B">Grade 11-B</option>
                  <option value="Grade 12-A">Grade 12-A</option>
                </select>
              </div>
            </div>

            {/* Gender Switch Buttons */}
            <div>
              <label className="block text-xs font-bold text-neutral-900 mb-1.5 uppercase tracking-wide">
                Gender *
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  id="btn-gender-male"
                  onClick={() => setGender('Male')}
                  className={`px-4 py-1.5 rounded border text-xs font-bold transition-all cursor-pointer ${
                    gender === 'Male'
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-500 border-neutral-200 hover:text-neutral-900 hover:border-neutral-400'
                  }`}
                >
                  ♂ Male
                </button>
                <button
                  type="button"
                  id="btn-gender-female"
                  onClick={() => setGender('Female')}
                  className={`px-4 py-1.5 rounded border text-xs font-bold transition-all cursor-pointer ${
                    gender === 'Female'
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-500 border-neutral-200 hover:text-neutral-900 hover:border-neutral-400'
                  }`}
                >
                  ♀ Female
                </button>
              </div>
            </div>

            {/* Optional Notes */}
            <div>
              <label htmlFor="input-student-notes" className="block text-xs font-bold text-neutral-900 mb-1.5 uppercase tracking-wide">
                Classroom Behavior / Notes (Optional)
              </label>
              <input
                id="input-student-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Needs front row seat near aisle; struggles with peer distractions."
                className="w-full bg-white border border-neutral-950 rounded px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Suggestion tags chips list */}
        <div className="bg-neutral-50 border border-neutral-200 rounded p-4 space-y-3">
          <label className="text-xs font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Assign Seating Tags (Click to select)
          </label>

          <div className="flex flex-wrap gap-1.5">
            {suggestedTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              const style = getTagStyle(tag);
              return (
                <button
                  type="button"
                  key={tag}
                  id={`btn-preset-tag-${tag.replace(/\s+/g, '-').toLowerCase()}`}
                  onClick={() => handleToggleTag(tag)}
                  className={`text-xs px-2.5 py-1 rounded border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-neutral-900 text-white border-neutral-900 font-bold'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : style.dot}`} />
                  <span>{tag}</span>
                  {isSelected && <X className="w-3 h-3 ml-0.5" />}
                </button>
              );
            })}
          </div>

          {/* Custom tag input form inside form */}
          <div className="flex gap-2 pt-2 border-t border-neutral-200">
            <input
              type="text"
              id="input-custom-tag"
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              onKeyDown={handleKeyDownCustomTag}
              placeholder="Type custom tag name..."
              className="flex-1 bg-white border border-neutral-300 focus:border-neutral-900 rounded px-2.5 py-1 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none"
            />
            <button
              type="button"
              id="btn-add-custom-tag"
              onClick={() => handleAddCustomTag()}
              disabled={!customTagInput.trim()}
              className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white text-xs font-semibold rounded border border-neutral-950 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Tag
            </button>
          </div>
        </div>

        {/* Action button triggers */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            id="btn-reset-form"
            onClick={() => {
              setName('');
              setRollNumber('');
              setNotes('');
              setGender('Male');
              setAvatar('');
              setSelectedTags([]);
              setCustomTagInput('');
              setErrorMsg('');
            }}
            className="px-3 py-1.5 text-neutral-500 hover:text-neutral-900 text-xs font-semibold transition-colors cursor-pointer"
          >
            Clear Fields
          </button>
          <button
            type="submit"
            id="btn-submit-add-student"
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider rounded border border-neutral-950 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Enroll Student
          </button>
        </div>
      </form>
    </div>
  );
};
