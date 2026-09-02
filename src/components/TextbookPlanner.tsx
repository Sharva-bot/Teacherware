import React, { useState, useEffect } from 'react';
import { 
  subscribeToMaterials, 
  createMaterial, 
  deleteMaterial, 
  updateMaterial 
} from '../services/materialsService';
import { TextbookMaterial } from '../types';
import {
  BookOpen,
  Plus,
  Trash2,
  FileText,
  FileQuestion,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Printer,
  Sparkles,
  Upload,
  FolderOpen,
  Folder,
  FileCode,
  Download,
  Edit3,
  Eye,
  Save,
  CheckSquare,
  HelpCircle,
  FolderPlus
} from 'lucide-react';
import Markdown from 'react-markdown';
import { jsPDF } from 'jspdf';

interface TextbookPlannerProps {
  mode?: 'scanner' | 'vault';
}

export const TextbookPlanner: React.FC<TextbookPlannerProps> = ({ mode = 'scanner' }) => {
  const [materials, setMaterials] = useState<TextbookMaterial[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Workspace views: 'studyGuide' or 'testPaper'
  const [activeView, setActiveView] = useState<'studyGuide' | 'testPaper'>('studyGuide');
  
  // Editor / Notepad States
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editText, setEditText] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');

  // Folder states
  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [newFolderName, setNewFolderName] = useState<string>('');
  
  // Form states for creating a new textbook material package
  const [title, setTitle] = useState<string>('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // AI Organize state
  const [isAIOrganizing, setIsAIOrganizing] = useState<boolean>(false);

  // UI status feedback
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<boolean>(false);

  // Realtime subscription
  useEffect(() => {
    const unsubscribe = subscribeToMaterials(
      (data) => {
        setMaterials(data);
        setIsLoading(false);
        // Default select first item if none is selected
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0].id);
        }
      },
      (err) => {
        console.error('Subscription error:', err);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [selectedId]);

  const selectedMaterial = materials.find((m) => m.id === selectedId) || null;

  // Sync editor fields when selected item or active view changes
  useEffect(() => {
    if (selectedMaterial) {
      setEditTitle(selectedMaterial.title);
      setEditText(activeView === 'studyGuide' ? (selectedMaterial.studyGuide || '') : (selectedMaterial.testPaper || ''));
    }
  }, [selectedId, activeView, selectedMaterial]);

  // Derived Folder List
  const customFolders = Array.from(
    new Set(materials.map((m) => m.folder || 'Unorganized'))
  ).filter(f => f !== 'Unorganized');
  const foldersList = ['All', 'Unorganized', ...customFolders];

  // Helper: Filter materials based on current active folder choice
  const filteredMaterials = materials.filter((m) => {
    if (selectedFolder === 'All') return true;
    if (selectedFolder === 'Unorganized') return !m.folder || m.folder === 'Unorganized';
    return m.folder === selectedFolder;
  });

  // Compress images inside client browser to stay below Firestore limits
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 950;
          const MAX_HEIGHT = 950;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCompressing(true);
    const compressedList: string[] = [...uploadedImages];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        const compressedBase64 = await compressImage(file);
        compressedList.push(compressedBase64);
      }
      setUploadedImages(compressedList);
    } catch (err) {
      console.error('Error compressing images:', err);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemoveUploadedImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (uploadedImages.length === 0) {
      setGenerationError('Please upload at least one textbook picture.');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    let matId = '';
    try {
      matId = await createMaterial({
        title: title.trim(),
        images: uploadedImages,
        studyGuide: null,
        testPaper: null,
        status: 'generating',
        createdAt: new Date().toISOString(),
        folder: selectedFolder !== 'All' ? selectedFolder : 'Unorganized'
      });
      setSelectedId(matId);
      setTitle('');
      setUploadedImages([]);
    } catch (err: any) {
      console.error('Firestore create material error:', err);
      setGenerationError('Failed to initialize material entry in database.');
      setIsGenerating(false);
      return;
    }

    try {
      const response = await fetch('/api/generate-material', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          images: uploadedImages,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Server returned an error generating materials.');
      }

      await updateMaterial(matId, {
        studyGuide: responseData.studyGuide,
        testPaper: responseData.testPaper,
        status: 'completed',
      });
    } catch (err: any) {
      console.error('Gemini call failed:', err);
      setGenerationError(err.message || 'Failed to generate study guides.');
      if (matId) {
        await updateMaterial(matId, {
          status: 'failed',
          error: err.message || 'Unknown processing error.'
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Create a blank Note/Guide to help with manual lesson structuring
  const handleCreateBlankNote = async () => {
    const noteTitle = prompt('Enter a title for your custom lesson document:');
    if (!noteTitle) return;

    try {
      const newId = await createMaterial({
        title: noteTitle.trim(),
        images: [],
        studyGuide: '# Custom Study Guide\nType your textbook notes, definitions, and class lessons here.',
        testPaper: '# Custom Test Paper\n### Section 1: Questions\n1. Example question here...',
        status: 'completed',
        createdAt: new Date().toISOString(),
        folder: selectedFolder !== 'All' ? selectedFolder : 'General Notes'
      });
      setSelectedId(newId);
      setIsEditing(true);
    } catch (err) {
      console.error('Failed to create custom document:', err);
    }
  };

  // AI-powered Automated Vault Organization
  const handleAIOrganizeVault = async () => {
    if (materials.length === 0) return;
    setIsAIOrganizing(true);

    const itemsToClassify = materials.map((m) => ({
      itemId: m.id,
      title: m.title,
      summaryExcerpt: (m.studyGuide || m.title).substring(0, 300)
    }));

    try {
      const res = await fetch('/api/organize-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToClassify })
      });

      if (!res.ok) throw new Error('Could not organize.');

      const data = await res.json();
      const classifications = data.classifications || [];

      // Update Firestore documents asynchronously
      for (const item of classifications) {
        if (item.itemId && item.suggestedFolder) {
          await updateMaterial(item.itemId, { folder: item.suggestedFolder });
        }
      }
    } catch (err) {
      console.error('AI Organize error:', err);
      alert('AI organization encountered an issue. Please verify your GEMINI_API_KEY.');
    } finally {
      setIsAIOrganizing(false);
    }
  };

  const handleDeleteMaterial = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this study material package?')) return;
    try {
      await deleteMaterial(id);
      if (selectedId === id) {
        setSelectedId(materials.length > 1 ? materials.filter(m => m.id !== id)[0].id : null);
      }
    } catch (err) {
      console.error('Error deleting material:', err);
    }
  };

  // Save changes from notepad text editor directly to Firestore
  const handleSaveEdits = async () => {
    if (!selectedMaterial) return;
    try {
      const updates: Partial<TextbookMaterial> = {
        title: editTitle.trim()
      };
      if (activeView === 'studyGuide') {
        updates.studyGuide = editText;
      } else {
        updates.testPaper = editText;
      }

      await updateMaterial(selectedMaterial.id, updates);
      setSaveFeedback(true);
      setTimeout(() => setSaveFeedback(false), 2000);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save document edits:', err);
    }
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setSelectedFolder(newFolderName.trim());
    setNewFolderName('');
  };

  const handleCopyText = (text: string | null) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleDownloadPDF = () => {
    if (!selectedMaterial) return;
    const textToExport = activeView === 'studyGuide' ? selectedMaterial.studyGuide : selectedMaterial.testPaper;
    if (!textToExport) return;

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const titleText = `${selectedMaterial.title} - ${activeView === 'studyGuide' ? 'Study Guide' : 'Test Paper'}`;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(23, 23, 23);
      doc.text(titleText, 15, 20);
      
      doc.setDrawColor(23, 23, 23);
      doc.setLineWidth(0.5);
      doc.line(15, 23, 195, 23);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(64, 64, 64);
      
      const cleanLines = textToExport
        .split('\n')
        .map(line => {
          return line
            .replace(/^#+\s+/, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\\/g, '');
        });

      let y = 32;
      const pageHeight = 275;
      const margin = 15;
      const contentWidth = 180;

      for (const line of cleanLines) {
        if (line.trim() === '') {
          y += 4;
          continue;
        }

        const splitLines = doc.splitTextToSize(line, contentWidth);
        for (const subLine of splitLines) {
          if (y > pageHeight) {
            doc.addPage();
            doc.setFont('Helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(115, 115, 115);
            doc.text(`${selectedMaterial.title} | ${activeView === 'studyGuide' ? 'Study Guide' : 'Test Paper'} | Page ${doc.getNumberOfPages()}`, margin, 12);
            doc.line(margin, 14, 195, 14);
            
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(64, 64, 64);
            y = 22;
          }
          
          doc.text(subLine, margin, y);
          y += 6.2;
        }
      }

      const fileName = `${selectedMaterial.title.replace(/[^a-zA-Z0-9]/g, '_')}_${activeView}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert('Could not generate PDF.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* LEFT COLUMN: Explorer Sidebar & Upload Workspace */}
      <div className="lg:col-span-4 space-y-6">
        
        {mode === 'scanner' && (
          /* Textbook Upload Form */
          <div className="bg-white border-2 border-neutral-950 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-neutral-900 text-white">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-neutral-900">
                    Material Scanner
                  </h2>
                  <p className="text-[10px] text-neutral-500">
                    Analyze pages or draft custom files
                  </p>
                </div>
              </div>

              {/* Quick Action to write a blank note instead of scanning */}
              <button
                onClick={handleCreateBlankNote}
                className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border border-neutral-300 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
                title="Create Custom Plain Document File"
              >
                <Plus className="w-3 h-3" /> Note
              </button>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Chapter / Concept Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Cellular Respiration and Krebs Cycle"
                  className="w-full text-xs border-2 border-neutral-900 rounded p-2.5 outline-none focus:bg-neutral-50 font-bold placeholder-neutral-400"
                />
              </div>

              {/* Images Upload Area */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Upload Textbook Pages
                </label>
                <div className="relative border-2 border-dashed border-neutral-300 rounded hover:border-neutral-900 transition-colors p-3.5 text-center cursor-pointer bg-neutral-50">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isCompressing || isGenerating}
                  />
                  <div className="space-y-1 text-neutral-600">
                    <Upload className="w-5 h-5 mx-auto text-neutral-400" />
                    <p className="text-[11px] font-bold text-neutral-900">Drag files or click to browse</p>
                    <p className="text-[9px] text-neutral-400 font-mono">JPG, PNG (Auto-compressed to stay lightweight)</p>
                  </div>
                </div>
              </div>

              {uploadedImages.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold text-neutral-400">
                    <span>Previews ({uploadedImages.length})</span>
                    <button 
                      type="button" 
                      onClick={() => setUploadedImages([])}
                      className="text-red-500 hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-1 max-h-32 overflow-y-auto border border-neutral-200 rounded p-1 bg-white">
                    {uploadedImages.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded border border-neutral-100 overflow-hidden bg-neutral-50">
                        <img src={img} alt="preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => handleRemoveUploadedImage(idx)}
                          className="absolute top-0.5 right-0.5 bg-red-600 text-white p-0.5 rounded-full hover:bg-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isCompressing && (
                <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-mono">
                  <Loader2 className="w-3 h-3 animate-spin text-neutral-900" />
                  <span>Compressing selected images...</span>
                </div>
              )}

              {generationError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{generationError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isGenerating || isCompressing || !title.trim() || uploadedImages.length === 0}
                className={`w-full py-2 rounded border-2 border-neutral-950 font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 ${
                  isGenerating || isCompressing || !title.trim() || uploadedImages.length === 0
                    ? 'bg-neutral-100 border-neutral-300 text-neutral-400 cursor-not-allowed shadow-none translate-x-0.5 translate-y-0.5'
                    : 'bg-neutral-950 text-white'
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    <span>Generating Study Aids...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    <span>Analyze with Gemini AI</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {mode !== 'scanner' ? (
          /* VAULT DIRECTORY & FOLDER TREE CONTAINER */
          <div className="bg-white border border-neutral-200 rounded-lg p-5 space-y-4">
            
            {/* Section Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-amber-500" />
                <span>Storage Vault</span>
              </h3>
              
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCreateBlankNote}
                  className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-[10px] font-black uppercase flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                  title="Create custom lesson or test paper note"
                >
                  <Plus className="w-3 h-3" /> Note
                </button>

                {/* AI Organize Button */}
                <button
                  onClick={handleAIOrganizeVault}
                  disabled={isAIOrganizing || materials.length === 0}
                  className="px-2 py-1 bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 disabled:opacity-50 disabled:cursor-not-allowed rounded text-[10px] font-black uppercase flex items-center gap-1 transition-all cursor-pointer"
                  title="Automatically categorize all of your materials into custom folders using Gemini AI"
                >
                  {isAIOrganizing ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Sorting...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 text-sky-500" />
                      <span>AI Organize Vault</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Create Folder Form */}
            <form onSubmit={handleCreateFolder} className="flex gap-1.5">
              <input
                type="text"
                placeholder="Create folder..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="flex-1 text-[11px] border border-neutral-300 rounded px-2 py-1 outline-none focus:border-neutral-900 font-bold"
              />
              <button
                type="submit"
                className="p-1.5 bg-neutral-900 text-white hover:bg-neutral-800 rounded cursor-pointer shrink-0"
                title="Add New Folder"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Symmetrical Scrollable Folder Tags Navigation */}
            <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-none">
              {foldersList.map((folder) => {
                const isSelected = selectedFolder === folder;
                const itemCount = materials.filter(m => {
                  if (folder === 'All') return true;
                  if (folder === 'Unorganized') return !m.folder || m.folder === 'Unorganized';
                  return m.folder === folder;
                }).length;

                return (
                  <button
                    key={folder}
                    onClick={() => setSelectedFolder(folder)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-full border whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                        : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    <span className="mr-1">📁</span>
                    {folder} ({itemCount})
                  </button>
                );
              })}
            </div>

            {/* File Directory List */}
            {isLoading ? (
              <div className="text-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-neutral-950 mx-auto" />
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="text-center py-8 text-neutral-400 border border-dashed border-neutral-200 rounded-lg">
                <BookOpen className="w-6 h-6 mx-auto mb-1 text-neutral-300" />
                <p className="text-[11px]">No items found in this folder.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {filteredMaterials.map((m) => {
                  const isSelected = m.id === selectedId;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={`p-2.5 rounded border text-left cursor-pointer transition-all flex items-start justify-between gap-2 ${
                        isSelected
                          ? 'border-neutral-900 bg-neutral-50 shadow-sm'
                          : 'border-neutral-200 hover:border-neutral-300 bg-white'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <h4 className="text-[11px] font-black text-neutral-950 truncate pr-2 flex items-center gap-1">
                          {m.images && m.images.length > 0 ? '📄' : '✍️'}
                          {m.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[8.5px] font-mono text-neutral-400">
                          <span>{m.folder || 'Unorganized'}</span>
                          <span>•</span>
                          {m.images ? `${m.images.length} pages` : 'Plain Text'}
                          {m.status === 'generating' && (
                            <span className="text-sky-600 font-bold flex items-center gap-0.5">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Processing
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteMaterial(m.id, e)}
                        className="text-neutral-400 hover:text-red-600 p-0.5 rounded hover:bg-neutral-100 shrink-0 transition-colors cursor-pointer"
                        title="Delete document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* RIGHT COLUMN: Active Material Workspace & Built-in Plain Text Editor */}
      <div className="lg:col-span-8">
        {!selectedMaterial ? (
          <div className="bg-white border-2 border-dashed border-neutral-300 rounded-lg p-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-neutral-50 border border-neutral-200 flex items-center justify-center mx-auto text-neutral-400">
              <BookOpen className="w-7 h-7 text-neutral-350" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-900">
                {mode === 'scanner' ? 'Awaiting Textbook Upload' : 'No Document Selected'}
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                {mode === 'scanner' 
                  ? 'Drag or select photos of textbook pages or homework worksheets in the Scanner panel on the left, and let Gemini AI extract comprehensive study guides and exams!' 
                  : 'Select an organized lesson, study guide, or exam sheet from your directory folders on the left, or click the quick "+ Note" button to start typing blank notes.'
                }
              </p>
            </div>
          </div>
        ) : selectedMaterial.status === 'generating' ? (
          <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center mx-auto shadow-inner">
              <Loader2 className="w-8 h-8 animate-spin text-neutral-900" />
            </div>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-sky-50 text-sky-800 border border-sky-200">
                <span>Analyzing Pages via Gemini 2.5</span>
              </div>
              <h3 className="text-base font-bold text-neutral-900">Generating Academic Material...</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                The models are reviewing the visual patterns, formatting key concept summary tables, and designing balanced test queries. This can take about 15-30 seconds.
              </p>
            </div>
          </div>
        ) : selectedMaterial.status === 'failed' ? (
          <div className="bg-white border border-red-200 rounded-lg p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto text-red-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-red-800">Generation Failed</h3>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                {selectedMaterial.error || 'Gemini encountered a transient error analyzing these pictures.'}
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => setSelectedId(selectedMaterial.id)}
                className="px-4 py-2 bg-neutral-900 text-white rounded font-bold text-xs hover:bg-neutral-800 transition-colors"
              >
                Retry Generation
              </button>
            </div>
          </div>
        ) : (
          /* WORKSPACE RENDERED CONTENT (WITH BUILD-IN NOTEPAD EDITOR TOGGLE) */
          <div className="bg-white border-2 border-neutral-950 rounded-lg shadow-sm overflow-hidden flex flex-col min-h-[550px]">
            
            {/* Header toolbar with Document Details & Folder Mover */}
            <div className="border-b-2 border-neutral-950 bg-neutral-50 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-black text-neutral-950 flex items-center gap-1.5 uppercase">
                    <BookOpen className="w-4 h-4 text-neutral-800" />
                    {selectedMaterial.title}
                  </h3>
                  
                  {/* Folder Mover Dropdown Tag */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-neutral-400 uppercase font-bold">In:</span>
                    <select
                      value={selectedMaterial.folder || 'Unorganized'}
                      onChange={async (e) => {
                        await updateMaterial(selectedMaterial.id, { folder: e.target.value });
                      }}
                      className="text-[10px] font-bold font-mono border border-neutral-300 rounded px-1.5 py-0.5 bg-white text-neutral-700 outline-none cursor-pointer hover:border-neutral-900"
                    >
                      <option value="Unorganized">📁 Unorganized</option>
                      <option value="General Notes">📁 General Notes</option>
                      {customFolders.map(folder => (
                        <option key={folder} value={folder}>📁 {folder}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-[9px] text-neutral-400 font-mono">
                  Database ID: {selectedMaterial.id} | Created {new Date(selectedMaterial.createdAt).toLocaleDateString()}
                </p>
              </div>

              {/* Action Toolbar buttons */}
              <div className="flex items-center flex-wrap gap-2">
                <div className="bg-neutral-200 border border-neutral-300 p-0.5 rounded flex gap-1">
                  <button
                    onClick={() => setActiveView('studyGuide')}
                    className={`px-2.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all ${
                      activeView === 'studyGuide'
                        ? 'bg-white border border-neutral-300 text-neutral-950 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-950'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Study Guide</span>
                  </button>
                  <button
                    onClick={() => setActiveView('testPaper')}
                    className={`px-2.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all ${
                      activeView === 'testPaper'
                        ? 'bg-white border border-neutral-300 text-neutral-950 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-950'
                    }`}
                  >
                    <FileQuestion className="w-3.5 h-3.5" />
                    <span>Test Paper</span>
                  </button>
                </div>

                <div className="h-6 w-[1px] bg-neutral-300 mx-1"></div>

                {/* Print, Copy, Download, and Edit/Notepad Mode Trigger */}
                <div className="flex items-center gap-1">
                  
                  {/* Built-in Editor Trigger Button */}
                  <button
                    onClick={() => {
                      if (isEditing) {
                        setIsEditing(false);
                      } else {
                        setIsEditing(true);
                        setEditTitle(selectedMaterial.title);
                        setEditText(activeView === 'studyGuide' ? (selectedMaterial.studyGuide || '') : (selectedMaterial.testPaper || ''));
                      }
                    }}
                    className={`p-2 border rounded transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-bold ${
                      isEditing 
                        ? 'bg-neutral-950 text-white border-neutral-900 hover:bg-neutral-800' 
                        : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950'
                    }`}
                    title="Toggle built-in plain-text Notepad Editor"
                  >
                    {isEditing ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-sky-400" />
                        <span>View Mode</span>
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-3.5 h-3.5 text-sky-500" />
                        <span>Edit Notepad</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleCopyText(activeView === 'studyGuide' ? selectedMaterial.studyGuide : selectedMaterial.testPaper)}
                    className="p-2 bg-white border border-neutral-300 rounded hover:bg-neutral-50 text-neutral-700 hover:text-neutral-950 transition-colors cursor-pointer flex items-center gap-1"
                    title="Copy Markdown"
                  >
                    {copiedText ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-[10px] font-bold text-green-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold">Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDownloadPDF}
                    className="p-2 bg-white border border-neutral-300 rounded hover:bg-neutral-50 text-neutral-700 hover:text-neutral-950 transition-colors cursor-pointer flex items-center gap-1"
                    title="Download as PDF Document"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-600" />
                    <span className="text-[10px] font-bold">PDF</span>
                  </button>

                  <button
                    onClick={handlePrint}
                    className="p-2 bg-white border border-neutral-300 rounded hover:bg-neutral-50 text-neutral-700 hover:text-neutral-950 transition-colors cursor-pointer flex items-center gap-1"
                    title="Print material"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold">Print</span>
                  </button>
                </div>
              </div>
            </div>

            {/* RENDER DYNAMIC VIEW OR NOTEPAD PLAIN-TEXT EDITOR */}
            <div className="flex-1 flex flex-col p-6 min-h-[400px]">
              
              {isEditing ? (
                /* BUILT-IN NOTEPAD STYLE PLAIN-TEXT EDITOR */
                <div className="flex-1 flex flex-col gap-4 animate-fade-in">
                  
                  {/* Document Title Editor field */}
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-black uppercase tracking-wider text-neutral-500 font-mono shrink-0">
                      Document Title:
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="flex-1 text-sm font-bold border-b border-neutral-300 pb-1 focus:border-neutral-900 outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono uppercase font-black text-sky-700 bg-sky-50 px-3 py-1.5 rounded border border-sky-200">
                    <span>
                      ✍️ Built-in Editor: Modifying {activeView === 'studyGuide' ? 'Study Guide' : 'Test Paper'} (Markdown styling supported)
                    </span>
                    <span>Plain Text Notepad</span>
                  </div>

                  {/* Notepad Text Editor Area */}
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="Write or edit your class notes, syllabus definitions, or exam questions in this notepad area..."
                    className="w-full flex-1 min-h-[350px] p-4 text-xs font-mono border-2 border-neutral-900 rounded outline-none focus:bg-neutral-50 resize-none leading-relaxed"
                  />

                  {/* Save Draft buttons */}
                  <div className="flex items-center gap-2 justify-end pt-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdits}
                      className="px-5 py-2.5 bg-neutral-900 text-white hover:bg-neutral-850 rounded text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    >
                      <Save className="w-4 h-4 text-sky-400" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* RICH MARKDOWN PREVIEW DISPLAY VIEW */
                <div className="prose prose-neutral max-w-none print:p-0 flex-1 overflow-y-auto max-h-[500px]">
                  <style>{`
                    .markdown-body h1 { font-size: 1.55em; font-weight: 900; border-bottom: 2px solid #171717; padding-bottom: 0.3em; margin-top: 1em; margin-bottom: 0.6em; text-transform: uppercase; letter-spacing: -0.025em; color: #0a0a0a; }
                    .markdown-body h2 { font-size: 1.2em; font-weight: 800; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.25em; margin-top: 1.2em; margin-bottom: 0.5em; color: #171717; }
                    .markdown-body h3 { font-size: 1.02em; font-weight: 700; margin-top: 1em; margin-bottom: 0.4em; color: #262626; }
                    .markdown-body p { font-size: 13.5px; line-height: 1.6; margin-bottom: 0.8em; color: #404040; }
                    .markdown-body ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 0.8em; font-size: 13.5px; line-height: 1.6; color: #404040; }
                    .markdown-body ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 0.8em; font-size: 13.5px; line-height: 1.6; color: #404040; }
                    .markdown-body li { margin-bottom: 0.25em; }
                    .markdown-body table { width: 100%; border-collapse: collapse; margin-bottom: 1em; font-size: 12px; }
                    .markdown-body th { background-color: #f5f5f5; border: 1px solid #d4d4d4; padding: 6px 10px; font-weight: 700; text-align: left; }
                    .markdown-body td { border: 1px solid #e5e5e5; padding: 6px 10px; }
                    .markdown-body blockquote { border-left: 4px solid #171717; background-color: #f9f9f9; padding: 8px 12px; font-style: italic; margin-bottom: 1em; }
                    .markdown-body hr { border: 0; border-top: 1px solid #e5e5e5; margin: 1.5em 0; }
                  `}</style>
                  
                  <div className="markdown-body">
                    {activeView === 'studyGuide' ? (
                      selectedMaterial.studyGuide ? (
                        <Markdown>{selectedMaterial.studyGuide}</Markdown>
                      ) : (
                        <p className="text-neutral-400 italic">No study guide available.</p>
                      )
                    ) : (
                      selectedMaterial.testPaper ? (
                        <Markdown>{selectedMaterial.testPaper}</Markdown>
                      ) : (
                        <p className="text-neutral-400 italic">No test paper available.</p>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer with camera pictures display */}
            {selectedMaterial.images && selectedMaterial.images.length > 0 && (
              <div className="border-t border-neutral-200 bg-neutral-50 p-4 flex items-center justify-between text-xs text-neutral-500">
                <span className="font-mono text-[10px]">
                  Analyzed from {selectedMaterial.images.length} uploaded files
                </span>
                <div className="flex gap-1.5 overflow-x-auto max-w-xs md:max-w-md p-1 bg-white border border-neutral-200 rounded">
                  {selectedMaterial.images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square w-8 rounded overflow-hidden border border-neutral-200 shrink-0">
                      <img src={img} alt="Textbook Thumbnail" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
