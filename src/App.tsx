import { useState, useMemo, useEffect } from 'react';
import teacherwareLogo from './assets/images/teacherware_logo_1788339220994.jpg';
import { Student } from './types';
import { StudentCard } from './components/StudentCard';
import { AddStudentForm } from './components/AddStudentForm';
import { SeatingArrangement } from './components/SeatingArrangement';
import { ClassroomEditor } from './components/ClassroomEditor';
import { TextbookPlanner } from './components/TextbookPlanner';
import { TestPaperGrader } from './components/TestPaperGrader';
import {
  subscribeToStudents,
  createStudent,
  deleteStudent,
  updateStudentTags,
  clearAllStudents,
} from './services/studentService';
import { TagFilterBar } from './components/TagFilterBar';
import {
  School,
  Users,
  Tag as TagIcon,
  Sparkles,
  BookOpenCheck,
  Cloud,
  Loader2,
  Trash2,
  UserPlus,
  LayoutGrid,
  Settings,
  BookOpen,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Menu,
  FileCheck,
} from 'lucide-react';

type TabType = 'students' | 'seating' | 'classroom' | 'vault' | 'grader';

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('students');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Subscribe to Firestore for live sync
  useEffect(() => {
    const unsubscribe = subscribeToStudents(
      (firestoreStudents) => {
        setStudents(firestoreStudents);
        setIsLoading(false);
      },
      (err) => {
        console.error('Firestore subscription error:', err);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Collect unique tags with counts
  const allUniqueTagsWithCounts = useMemo(() => {
    const countsMap = new Map<string, number>();
    students.forEach((student) => {
      student.tags.forEach((t) => {
        countsMap.set(t, (countsMap.get(t) || 0) + 1);
      });
    });

    return Array.from(countsMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [students]);

  const allAvailableTagNames = useMemo(() => {
    return allUniqueTagsWithCounts.map((item) => item.tag);
  }, [allUniqueTagsWithCounts]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (selectedFilterTags.length > 0) {
        const hasAllSelectedTags = selectedFilterTags.every((filterTag) =>
          student.tags.some(
            (studentTag) => studentTag.toLowerCase() === filterTag.toLowerCase()
          )
        );
        if (!hasAllSelectedTags) return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = student.name.toLowerCase().includes(query);
        const matchesRoll = student.rollNumber.toLowerCase().includes(query);
        const matchesGrade = student.grade.toLowerCase().includes(query);
        const matchesTag = student.tags.some((tag) =>
          tag.toLowerCase().includes(query)
        );
        const matchesNotes = student.notes?.toLowerCase().includes(query) || false;

        return matchesName || matchesRoll || matchesGrade || matchesTag || matchesNotes;
      }

      return true;
    });
  }, [students, selectedFilterTags, searchQuery]);

  // Create student
  const handleAddStudent = async (newStudentData: Omit<Student, 'id'>) => {
    setIsSyncing(true);
    try {
      await createStudent(newStudentData);
    } catch (err) {
      console.error('Failed to add student to Firestore:', err);
      // fallback
      const newStudent: Student = {
        ...newStudentData,
        id: `std-${Date.now()}`,
      };
      setStudents((prev) => [newStudent, ...prev]);
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete student
  const handleDeleteStudent = async (studentId: string) => {
    setIsSyncing(true);
    try {
      await deleteStudent(studentId);
    } catch (err) {
      console.error('Failed to delete student from Firestore:', err);
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
    } finally {
      setIsSyncing(false);
    }
  };

  // Remove tag
  const handleRemoveTag = async (studentId: string, tagToRemove: string) => {
    const currentStudent = students.find((s) => s.id === studentId);
    if (!currentStudent) return;
    const updatedTags = currentStudent.tags.filter((t) => t !== tagToRemove);

    try {
      await updateStudentTags(studentId, updatedTags);
    } catch (err) {
      console.error('Failed to remove tag in Firestore:', err);
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, tags: updatedTags } : s))
      );
    }
  };

  // Add tag
  const handleAddTagToStudent = async (studentId: string, newTag: string) => {
    const currentStudent = students.find((s) => s.id === studentId);
    if (!currentStudent || currentStudent.tags.includes(newTag)) return;
    const updatedTags = [...currentStudent.tags, newTag];

    try {
      await updateStudentTags(studentId, updatedTags);
    } catch (err) {
      console.error('Failed to add tag in Firestore:', err);
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, tags: updatedTags } : s))
      );
    }
  };

  const handleToggleFilterTag = (tag: string) => {
    setSelectedFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleClearFilters = () => {
    setSelectedFilterTags([]);
    setSearchQuery('');
  };

  const handleClearAllRoster = async () => {
    if (students.length === 0) return;
    if (window.confirm('Are you sure you want to clear all enrolled student profiles from the roster?')) {
      setIsSyncing(true);
      try {
        await clearAllStudents();
        setStudents([]);
      } catch (err) {
        console.error('Failed to clear students in Firestore:', err);
      } finally {
        setIsSyncing(false);
      }
      setSelectedFilterTags([]);
      setSearchQuery('');
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-neutral-900 font-sans flex flex-col md:flex-row">
      {/* SIDEBAR NAVIGATION */}
      <aside 
        className={`bg-white border-b-2 md:border-b-0 md:border-r-2 border-neutral-900 flex flex-col justify-between transition-all duration-300 z-30 shrink-0 ${
          isSidebarOpen ? 'w-full md:w-64' : 'w-full md:w-20'
        }`}
      >
        <div className="flex flex-col">
          {/* Logo & Header */}
          <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded bg-neutral-900 flex items-center justify-center text-white border border-neutral-900 shrink-0 overflow-hidden">
                <img 
                  src={teacherwareLogo} 
                  alt="Teacherware Logo" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              {isSidebarOpen && (
                <div className="truncate">
                  <span className="block text-[11px] font-black tracking-tight text-neutral-900 uppercase">
                    Teacherware
                  </span>
                  <span className="block text-[8px] font-bold font-mono text-neutral-500 tracking-wider uppercase">
                    Classroom OS
                  </span>
                </div>
              )}
            </div>

            {/* Close sidebar button on desktop */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:flex p-1 hover:bg-neutral-100 rounded text-neutral-500 hover:text-neutral-900 cursor-pointer transition-colors border border-neutral-200"
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Tab Links */}
          <nav className="p-3 space-y-1">
            {/* Student Directory Tab */}
            <button
              id="tab-trigger-students"
              onClick={() => setActiveTab('students')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'students'
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'bg-white border border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
              }`}
              title="Student Profiles Directory"
            >
              <Users className="w-4 h-4 shrink-0" />
              {isSidebarOpen ? (
                <span className="truncate">Student Directory</span>
              ) : (
                <span className="md:hidden text-[10px]">Student Directory</span>
              )}
            </button>

            {/* AI Seating Arrangement Tab */}
            <button
              id="tab-trigger-seating"
              onClick={() => setActiveTab('seating')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'seating'
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'bg-white border border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
              }`}
              title="AI Seating Arrangement"
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              {isSidebarOpen ? (
                <span className="truncate">Seating Chart</span>
              ) : (
                <span className="md:hidden text-[10px]">Seating Chart</span>
              )}
            </button>

            {/* Classroom Layout Editor Tab */}
            <button
              id="tab-trigger-classroom"
              onClick={() => setActiveTab('classroom')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'classroom'
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'bg-white border border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
              }`}
              title="Classroom Floor Plan Layout"
            >
              <Settings className="w-4 h-4 shrink-0" />
              {isSidebarOpen ? (
                <span className="truncate">Floor Plan Layout</span>
              ) : (
                <span className="md:hidden text-[10px]">Floor Plan Layout</span>
              )}
            </button>

            {/* Storage Vault Tab */}
            <button
              id="tab-trigger-vault"
              onClick={() => setActiveTab('vault')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'vault'
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'bg-white border border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
              }`}
              title="Storage Vault"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FolderOpen className="w-4 h-4 shrink-0 text-amber-500 animate-pulse" />
                {isSidebarOpen ? (
                  <span className="truncate">Storage Vault</span>
                ) : (
                  <span className="md:hidden text-[10px]">Storage Vault</span>
                )}
              </div>
            </button>

            {/* Test Paper Grader Tab */}
            <button
              id="tab-trigger-grader"
              onClick={() => setActiveTab('grader')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'grader'
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'bg-white border border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
              }`}
              title="Test Paper Auto-Grader"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                {isSidebarOpen ? (
                  <span className="truncate">Test Auto-Grader</span>
                ) : (
                  <span className="md:hidden text-[10px]">Test Auto-Grader</span>
                )}
              </div>
              {isSidebarOpen && (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-black uppercase bg-emerald-100 border border-emerald-300 text-emerald-800 tracking-normal shrink-0">
                  NEW
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Collapsed view indicator for desktop */}
        {!isSidebarOpen && (
          <div className="hidden md:flex flex-col items-center gap-2 pb-6 text-[10px] text-neutral-400 font-mono">
            <span>•••</span>
          </div>
        )}
      </aside>

      {/* MAIN CONTENT WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOP STATUS BAR & ACTIONS HEADER */}
        <header className="border-b-2 border-neutral-900 bg-white shadow-sm p-4 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Header left: Mobile Menu Button & active view label */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden p-2 rounded border border-neutral-300 hover:bg-neutral-50 cursor-pointer"
                title="Toggle Menu"
              >
                <Menu className="w-5 h-5 text-neutral-700" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-neutral-100 border border-neutral-200 text-neutral-600 uppercase tracking-wider">
                    {activeTab === 'students' && 'Directory'}
                    {activeTab === 'seating' && 'AI Arranger'}
                    {activeTab === 'classroom' && 'Design Canvas'}
                    {activeTab === 'vault' && 'Curriculum Storage'}
                    {activeTab === 'grader' && 'Auto Grader'}
                  </span>
                  <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-neutral-100 border border-neutral-200 text-neutral-600">
                    {isSyncing ? (
                      <>
                        <Loader2 className="w-2.5 h-2.5 animate-spin text-neutral-500" /> Syncing...
                      </>
                    ) : (
                      <>
                        <Cloud className="w-2.5 h-2.5 text-neutral-500" /> Live Firestore
                      </>
                    )}
                  </div>
                </div>
                <h1 className="text-lg font-black text-neutral-950 tracking-tight mt-0.5">
                  {activeTab === 'students' && 'Student Profiles & Behavior Roster'}
                  {activeTab === 'seating' && 'AI-Optimized Classroom Seating'}
                  {activeTab === 'classroom' && 'Interactive Floor Plan & Bench Layout'}
                  {activeTab === 'vault' && 'Curriculum & Test Paper Storage Vault'}
                  {activeTab === 'grader' && 'Test Paper Auto-Grader & Anti-Cheat'}
                </h1>
              </div>
            </div>

            {/* Header Right: Stats counter */}
            <div className="flex items-center gap-2">
              <div className="bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 flex items-center gap-2 shrink-0">
                <Users className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-[11px] font-mono font-bold text-neutral-800">
                  {students.length} Students
                </span>
              </div>

              <div className="bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 flex items-center gap-2 shrink-0">
                <TagIcon className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-[11px] font-mono font-bold text-neutral-800">
                  {allUniqueTagsWithCounts.length} Tags
                </span>
              </div>

              {students.length > 0 && activeTab === 'students' && (
                <button
                  id="btn-clear-all-roster"
                  type="button"
                  onClick={handleClearAllRoster}
                  title="Clear all student profiles"
                  className="p-2 rounded bg-neutral-50 hover:bg-red-50 border border-neutral-300 hover:border-red-200 text-neutral-500 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* CONTAINER VIEW WRAPPER */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {activeTab === 'students' ? (
            <div className="space-y-8 animate-fade-in">
              {/* Enrollment Form */}
              <section id="section-enroll-student">
                <AddStudentForm
                  onAddStudent={handleAddStudent}
                  allAvailableTags={allAvailableTagNames}
                />
              </section>
      
              {/* Search and Filters */}
              {students.length > 0 && (
                <section id="section-tag-filters">
                  <TagFilterBar
                    allTagsWithCounts={allUniqueTagsWithCounts}
                    selectedTags={selectedFilterTags}
                    onToggleTag={handleToggleFilterTag}
                    onClearFilters={handleClearFilters}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    totalStudents={students.length}
                    filteredCount={filteredStudents.length}
                  />
                </section>
              )}

              {/* Students list */}
              <section id="section-student-list" className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500">
                    <BookOpenCheck className="w-4 h-4" />
                    <span>Enrolled Student Profiles</span>
                  </div>
                  <div className="text-xs font-mono text-neutral-400">
                    {isLoading ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin text-neutral-500" /> Loading...
                      </span>
                    ) : (
                      `${filteredStudents.length} of ${students.length} matching`
                    )}
                  </div>
                </div>

                {isLoading ? (
                  <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-neutral-900 mx-auto mb-2" />
                    <p className="text-xs font-mono text-neutral-500">Loading student roster...</p>
                  </div>
                ) : students.length === 0 ? (
                  <div
                    id="empty-roster-state"
                    className="bg-white border-2 border-dashed border-neutral-300 rounded-lg p-12 text-center space-y-3.5"
                  >
                    <div className="w-11 h-11 rounded border border-neutral-300 bg-neutral-50 flex items-center justify-center mx-auto text-neutral-400">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
                        Roster is Empty
                      </h3>
                      <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 leading-relaxed">
                        Register student profiles in the form above to build your class directory and assign seating behavior preferences.
                      </p>
                    </div>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div
                    id="empty-filtered-state"
                    className="bg-white border border-dashed border-neutral-200 rounded-lg p-12 text-center space-y-3.5"
                  >
                    <div className="w-10 h-10 rounded border border-neutral-200 bg-neutral-50 flex items-center justify-center mx-auto text-neutral-400">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900">No students match your criteria</h3>
                      <p className="text-xs text-neutral-500 mt-1">
                        Try resetting filters or changing search keywords.
                      </p>
                    </div>
                    <button
                      id="btn-empty-clear-filters"
                      onClick={handleClearFilters}
                      className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded border border-neutral-950 transition-colors cursor-pointer"
                    >
                      Reset Filter
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredStudents.map((student) => (
                      <StudentCard
                        key={student.id}
                        student={student}
                        onRemoveTag={handleRemoveTag}
                        onAddTag={handleAddTagToStudent}
                        onDeleteStudent={handleDeleteStudent}
                        activeFilterTags={selectedFilterTags}
                        onTagClick={handleToggleFilterTag}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : activeTab === 'seating' ? (
            <div className="max-w-4xl mx-auto py-2 animate-fade-in">
              <section id="section-seating-chart">
                <SeatingArrangement students={students} />
              </section>
            </div>
          ) : activeTab === 'classroom' ? (
            <div className="animate-fade-in">
              <section id="section-classroom-editor">
                <ClassroomEditor />
              </section>
            </div>
          ) : activeTab === 'vault' ? (
            <div className="animate-fade-in">
              <section id="section-textbook-vault">
                <TextbookPlanner mode="vault" />
              </section>
            </div>
          ) : (
            <div className="animate-fade-in">
              <section id="section-test-grader">
                <TestPaperGrader students={students} />
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
