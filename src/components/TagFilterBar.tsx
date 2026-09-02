import React from 'react';
import { getTagStyle } from '../utils/tagColors';
import { Filter, Search, X, Layers } from 'lucide-react';

interface TagFilterBarProps {
  allTagsWithCounts: { tag: string; count: number }[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearFilters: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalStudents: number;
  filteredCount: number;
}

export const TagFilterBar: React.FC<TagFilterBarProps> = ({
  allTagsWithCounts,
  selectedTags,
  onToggleTag,
  onClearFilters,
  searchQuery,
  onSearchChange,
  totalStudents,
  filteredCount,
}) => {
  return (
    <div className="bg-white border border-neutral-900 rounded-lg p-5 shadow-[1px_1px_0px_rgba(0,0,0,1)] space-y-4">
      {/* Top Filter and Search Bar row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-neutral-900">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter & Search</span>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-neutral-700 font-mono">
            Showing <strong>{filteredCount}</strong> of {totalStudents} Profiles
          </span>
        </div>

        {/* Quick Search */}
        <div className="relative flex-1 max-w-sm w-full">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-filter"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Type name, roll, or tag..."
            className="w-full bg-white border border-neutral-900 rounded pl-8.5 pr-8 py-1.5 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-900"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tags Filters row */}
      <div className="flex flex-wrap items-center gap-2 pt-3.5 border-t border-neutral-100">
        {/* All trigger pill */}
        <button
          id="btn-filter-all"
          type="button"
          onClick={onClearFilters}
          className={`px-3 py-1 rounded text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedTags.length === 0 && !searchQuery
              ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
              : 'bg-white text-neutral-600 border-neutral-200 hover:text-neutral-950 hover:border-neutral-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Students</span>
          <span className="ml-1 px-1.5 py-0.2 bg-neutral-100 rounded text-[10px] font-mono text-neutral-700">
            {totalStudents}
          </span>
        </button>

        {/* Individual tag badges list */}
        {allTagsWithCounts.map(({ tag, count }) => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              id={`btn-filter-tag-${tag.replace(/\s+/g, '-').toLowerCase()}`}
              type="button"
              onClick={() => onToggleTag(tag)}
              className={`px-3 py-1 rounded text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-900 hover:text-neutral-950'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-neutral-400'}`} />
              <span>{tag}</span>
              <span className={`ml-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono ${
                isSelected ? 'bg-neutral-800 text-neutral-100' : 'bg-neutral-100 text-neutral-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}

        {/* Clear Trigger option */}
        {(selectedTags.length > 0 || searchQuery) && (
          <button
            id="btn-clear-active-filters"
            type="button"
            onClick={onClearFilters}
            className="text-xs font-semibold text-neutral-500 hover:text-red-600 hover:underline px-2 py-1 flex items-center gap-1 ml-auto cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Clear Filters
          </button>
        )}
      </div>
    </div>
  );
};
