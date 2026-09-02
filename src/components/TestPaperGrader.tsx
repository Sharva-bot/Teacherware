import React, { useState, useEffect } from 'react';
import { Student, ExamRecord, GradedPaperResult, QuestionCorrection } from '../types';
import { subscribeToExams, createExamRecord, updateExamRecord, deleteExamRecord } from '../services/graderService';
import { getActiveSeatingArrangement, saveCheatingAlert } from '../services/seatingService';
import { createMaterial } from '../services/materialsService';
import {
  FileCheck,
  Upload,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Download,
  Trash2,
  Search,
  Eye,
  Plus,
  Table,
  BarChart3,
  BookOpen,
  X,
  FileSpreadsheet,
  Printer,
  Check,
  UserCheck,
  HelpCircle,
  FileText,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';

interface TestPaperGraderProps {
  students: Student[];
}

export const TestPaperGrader: React.FC<TestPaperGraderProps> = ({ students }) => {
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [isLoadingExams, setIsLoadingExams] = useState<boolean>(true);

  // New Exam Form State
  const [examTitle, setExamTitle] = useState<string>('');
  const [maxScore, setMaxScore] = useState<number>(100);
  const [answerKey, setAnswerKey] = useState<string>('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  
  // Processing state
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [gradingProgress, setGradingProgress] = useState<{ current: number; total: number } | null>(null);
  const [gradingError, setGradingError] = useState<string | null>(null);

  // Cheating alert notification state
  const [isDetectingCheating, setIsDetectingCheating] = useState<boolean>(false);
  const [cheatingNotice, setCheatingNotice] = useState<string | null>(null);

  // Table Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'graded' | 'unmatched'>('all');

  // Inspection Modal State
  const [inspectedPaper, setInspectedPaper] = useState<GradedPaperResult | null>(null);

  // Subscribe to live Firestore exam records
  useEffect(() => {
    const unsubscribe = subscribeToExams(
      (data) => {
        setExams(data);
        setIsLoadingExams(false);
        if (data.length > 0 && !selectedExamId) {
          setSelectedExamId(data[0].id);
        }
      },
      (err) => {
        console.error('Failed to load exams:', err);
        setIsLoadingExams(false);
      }
    );
    return () => unsubscribe();
  }, [selectedExamId]);

  const activeExam = exams.find((e) => e.id === selectedExamId) || null;

  // Handle image upload and compression
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (!result) return;

        // Compress image using Canvas
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1200;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.75);
            setUploadedImages((prev) => [...prev, compressed]);
          }
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  // Run Batch Auto-Grading with Gemini
  const handleRunBatchGrading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadedImages.length === 0) return;
    if (!examTitle.trim()) {
      setGradingError('Please enter an exam title.');
      return;
    }

    setIsGrading(true);
    setGradingError(null);
    setGradingProgress({ current: 0, total: uploadedImages.length });

    const gradedResults: GradedPaperResult[] = [];

    try {
      for (let i = 0; i < uploadedImages.length; i++) {
        setGradingProgress({ current: i + 1, total: uploadedImages.length });
        const img = uploadedImages[i];

        const response = await fetch('/api/grade-test-paper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: img,
            students: students,
            examTitle: examTitle.trim(),
            maxScore: Number(maxScore) || 100,
            answerKey: answerKey.trim(),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to grade paper #${i + 1}`);
        }

        const data = await response.json();

        // Cross check roll number if matched student
        let rollNo = 'N/A';
        if (data.matchedStudentId) {
          const foundStudent = students.find((s) => s.id === data.matchedStudentId);
          if (foundStudent) rollNo = foundStudent.rollNumber;
        }

        const paperResult: GradedPaperResult = {
          id: `paper-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          imageUri: img,
          detectedName: data.detectedName || 'Unknown Student',
          matchedStudentId: data.matchedStudentId || null,
          matchedStudentName: data.matchedStudentName || data.detectedName || 'Unassigned',
          rollNumber: rollNo,
          status: data.status === 'uncorrected_guardrail_blocked' 
            ? 'uncorrected_guardrail_blocked' 
            : data.status === 'graded' ? 'graded' : 'unmatched',
          score: typeof data.score === 'number' ? data.score : 0,
          maxScore: Number(maxScore) || 100,
          percentage: typeof data.percentage === 'number' ? data.percentage : Math.round(((data.score || 0) / (maxScore || 100)) * 100),
          grade: data.grade || (data.status === 'uncorrected_guardrail_blocked' ? 'N/A' : 'C'),
          overallFeedback: data.overallFeedback || 'Evaluated by Gemini AI.',
          questionBreakdown: Array.isArray(data.questionBreakdown) ? data.questionBreakdown : [],
          gradedAt: new Date().toISOString(),
          isTeacherCorrected: data.isTeacherCorrected,
          teacherCorrectionDetected: data.teacherCorrectionDetected,
          guardrailMessage: data.guardrailMessage,
          teacherGradingAudit: data.teacherGradingAudit,
        };

        if (data.status === 'uncorrected_guardrail_blocked' || data.teacherCorrectionDetected === false) {
          setCheatingNotice(`🛡️ Safety Guardrail Triggered: Test paper for "${data.detectedName}" was BLOCKED because no human teacher corrections (ticks/scores) were found. The AI is restricted to double-checking papers corrected by teachers.`);
        }

        gradedResults.push(paperResult);
      }

      let targetExamTitle = examTitle.trim();
      let allPapers = gradedResults;
      let targetExamId = selectedExamId;

      // If active exam exists, append results to it. Otherwise create a new Exam Record
      if (activeExam) {
        const updatedPapers = [...activeExam.gradedPapers, ...gradedResults];
        await updateExamRecord(activeExam.id, { gradedPapers: updatedPapers });
        targetExamTitle = activeExam.examTitle;
        allPapers = updatedPapers;
        targetExamId = activeExam.id;
      } else {
        const newExamId = await createExamRecord({
          examTitle: examTitle.trim(),
          maxScore: Number(maxScore) || 100,
          createdAt: new Date().toISOString(),
          answerKey: answerKey.trim(),
          gradedPapers: gradedResults,
        });
        setSelectedExamId(newExamId);
        targetExamId = newExamId;
      }

      // Save each corrected test paper directly into Storage Vault (materials collection)
      for (const paper of gradedResults) {
        try {
          const breakdownMd = paper.questionBreakdown.map(q => 
            `* **Question ${q.questionNumber}:** ${q.isCorrect ? '✅ Correct' : '❌ Incorrect'} (${q.marksAwarded}/${q.maxMarks} marks)\n  - Student Answer: ${q.studentAnswer}\n  - Correct Answer: ${q.correctAnswer || 'N/A'}\n  - Feedback: ${q.feedback || 'N/A'}`
          ).join('\n\n');

          const reportText = `# Corrected Test Paper: ${paper.matchedStudentName}
**Exam Title:** ${targetExamTitle}
**Student Name:** ${paper.matchedStudentName} ${paper.rollNumber ? `(Roll No: ${paper.rollNumber})` : ''}
**Score:** ${paper.score} / ${paper.maxScore} (${paper.percentage}%)
**Grade:** ${paper.grade}
**Graded Date:** ${new Date(paper.gradedAt).toLocaleString()}

---

### Overall Evaluation Feedback:
${paper.overallFeedback}

---

### Question-by-Question Breakdown:
${breakdownMd}
`;

          await createMaterial({
            title: `[Corrected Paper] ${paper.matchedStudentName} - ${targetExamTitle} (${paper.score}/${paper.maxScore})`,
            images: paper.imageUri ? [paper.imageUri] : [],
            studyGuide: reportText,
            testPaper: answerKey.trim() ? `# Exam Answer Key\n${answerKey.trim()}` : '# Exam Answer Key\nStandard Automated Answer Key',
            status: 'completed',
            createdAt: paper.gradedAt || new Date().toISOString(),
            folder: 'Corrected Test Papers'
          });
        } catch (vaultErr) {
          console.error('Failed to save paper to Storage Vault:', vaultErr);
        }
      }

      // Reset Form
      setUploadedImages([]);
      setAnswerKey('');
      setExamTitle('');

      // Auto-trigger seating-cross-referenced anti-cheating scan
      await runCheatingDetection(targetExamTitle, allPapers, targetExamId || undefined);
    } catch (err: any) {
      console.error('Batch grading error:', err);
      setGradingError(err.message || 'An error occurred while evaluating test papers.');
    } finally {
      setIsGrading(false);
      setGradingProgress(null);
    }
  };

  const runCheatingDetection = async (title: string, papers: GradedPaperResult[], currentExamId?: string) => {
    setIsDetectingCheating(true);
    setCheatingNotice(null);
    try {
      const activeArrangement = await getActiveSeatingArrangement();
      if (!activeArrangement || !activeArrangement.assignments || activeArrangement.assignments.length === 0) {
        setCheatingNotice('Notice: No active seating map found in Firebase. Generate a seating map to cross-reference seated neighbors.');
        return;
      }

      const response = await fetch('/api/detect-cheating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examRecord: { examTitle: title, gradedPapers: papers },
          assignments: activeArrangement.assignments,
          benches: [
            { id: 'bench-1', name: 'Bench 1 (Front Row L)' },
            { id: 'bench-2', name: 'Bench 2 (Front Row R)' },
            { id: 'bench-3', name: 'Bench 3 (Middle Row L)' },
            { id: 'bench-4', name: 'Bench 4 (Middle Row R)' },
            { id: 'bench-5', name: 'Bench 5 (Back Row L)' },
            { id: 'bench-6', name: 'Bench 6 (Back Row R)' },
          ]
        }),
      });

      if (!response.ok) {
        const errorMsg = await response.json();
        console.warn('Cheating check returned status:', errorMsg);
        return;
      }

      const data = await response.json();
      if (Array.isArray(data.alerts) && data.alerts.length > 0) {
        for (const alertItem of data.alerts) {
          await saveCheatingAlert({
            examId: currentExamId || activeExam?.id || 'exam-1',
            examTitle: title,
            student1Id: alertItem.student1Id,
            student1Name: alertItem.student1Name,
            student2Id: alertItem.student2Id,
            student2Name: alertItem.student2Name,
            benchId: alertItem.benchId,
            benchName: alertItem.benchName,
            similarityPercentage: alertItem.similarityPercentage,
            suspicionLevel: alertItem.suspicionLevel,
            identicalMistakes: alertItem.identicalMistakes || [],
            summary: alertItem.summary,
            status: 'active_warning',
            detectedAt: new Date().toISOString()
          });
        }
        setCheatingNotice(`🚨 Gemini Anti-Cheat Flagged ${data.alerts.length} suspicious pair(s) seated on the same bench! Warning & mandatory separation options sent to Seating tab.`);
      } else {
        setCheatingNotice('✅ Anti-Cheat Scan Complete: No suspicious cheating patterns detected between seated bench neighbors.');
      }
    } catch (err: any) {
      console.error('Failed anti-cheating check:', err);
    } finally {
      setIsDetectingCheating(false);
    }
  };

  // Manual re-assignment of student to paper
  const handleAssignStudent = async (paperId: string, studentId: string) => {
    if (!activeExam) return;

    const matchedStudent = students.find((s) => s.id === studentId);
    const updatedPapers = activeExam.gradedPapers.map((p) => {
      if (p.id === paperId) {
        return {
          ...p,
          matchedStudentId: studentId || null,
          matchedStudentName: matchedStudent ? matchedStudent.name : p.detectedName,
          rollNumber: matchedStudent ? matchedStudent.rollNumber : 'N/A',
          status: (studentId ? 'graded' : 'unmatched') as 'graded' | 'unmatched',
        };
      }
      return p;
    });

    await updateExamRecord(activeExam.id, { gradedPapers: updatedPapers });
  };

  // Delete a graded paper from active exam
  const handleDeletePaper = async (paperId: string) => {
    if (!activeExam) return;
    const updatedPapers = activeExam.gradedPapers.filter((p) => p.id !== paperId);
    await updateExamRecord(activeExam.id, { gradedPapers: updatedPapers });
    if (inspectedPaper?.id === paperId) {
      setInspectedPaper(null);
    }
  };

  // Delete entire Exam Record
  const handleDeleteExam = async (examId: string) => {
    if (window.confirm('Are you sure you want to delete this entire exam mark sheet record?')) {
      await deleteExamRecord(examId);
      if (selectedExamId === examId) {
        setSelectedExamId(null);
      }
    }
  };

  // Export Class Spreadsheet as CSV
  const handleExportCSV = () => {
    if (!activeExam || activeExam.gradedPapers.length === 0) return;

    const headers = ['Roll No', 'Student Name (Roster)', 'Name on Test Paper', 'Score Obtained', 'Max Score', 'Percentage %', 'Grade', 'Status', 'Feedback Remarks'];
    const rows = activeExam.gradedPapers.map((p) => [
      `"${p.rollNumber || 'N/A'}"`,
      `"${p.matchedStudentName.replace(/"/g, '""')}"`,
      `"${p.detectedName.replace(/"/g, '""')}"`,
      p.score,
      p.maxScore,
      `${p.percentage}%`,
      `"${p.grade}"`,
      `"${p.status}"`,
      `"${p.overallFeedback.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeExam.examTitle.replace(/[^a-z0-9]/gi, '_')}_Class_Marksheet.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Marksheet
  const handlePrint = () => {
    window.print();
  };

  // Filter papers for active exam
  const filteredPapers = (activeExam?.gradedPapers || []).filter((p) => {
    const matchesSearch =
      p.matchedStudentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.detectedName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.rollNumber && p.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()));

    if (statusFilter === 'graded') return matchesSearch && p.status === 'graded';
    if (statusFilter === 'unmatched') return matchesSearch && p.status === 'unmatched';
    return matchesSearch;
  });

  // Calculate statistics
  const totalPapers = activeExam?.gradedPapers.length || 0;
  const averageScore = totalPapers > 0 ? Math.round((activeExam!.gradedPapers.reduce((acc, curr) => acc + curr.percentage, 0) / totalPapers) * 10) / 10 : 0;
  const highestScore = totalPapers > 0 ? Math.max(...activeExam!.gradedPapers.map((p) => p.score)) : 0;
  const passCount = totalPapers > 0 ? activeExam!.gradedPapers.filter((p) => p.percentage >= 40).length : 0;
  const passRate = totalPapers > 0 ? Math.round((passCount / totalPapers) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="bg-white border-2 border-neutral-900 rounded-lg p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded bg-neutral-900 text-white">
            <FileCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-black uppercase tracking-wider text-neutral-900 flex items-center gap-2">
              <span>AI Test Paper Auto-Grader</span>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Gemini Vision + Roster Sync
              </span>
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Upload handwritten or printed test papers. Gemini reads student names, cross-checks your roster, grades answers, and builds a class marksheet spreadsheet.
            </p>
          </div>
        </div>

        {/* Existing Exam Selector Dropdown */}
        {exams.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase text-neutral-500 whitespace-nowrap">Exam Session:</label>
            <select
              value={selectedExamId || ''}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="text-xs border-2 border-neutral-900 font-bold rounded p-2 bg-neutral-50 outline-none"
            >
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.examTitle} ({exam.gradedPapers.length} papers)
                </option>
              ))}
            </select>
            {activeExam && (
              <button
                onClick={() => handleDeleteExam(activeExam.id)}
                className="p-2 text-neutral-400 hover:text-red-600 hover:bg-neutral-100 rounded cursor-pointer transition-colors"
                title="Delete this Exam Record"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* TWO COLUMN WORKSPACE: LEFT UPLOADER, RIGHT SPREADSHEET */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT PANEL: TEST PAPER UPLOADER FORM */}
        <div className="lg:col-span-4 bg-white border-2 border-neutral-950 rounded-lg p-5 shadow-sm space-y-4">
          <div className="border-b border-neutral-200 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-sky-500" />
              <span>Upload Test Papers</span>
            </h3>
            <span className="text-[10px] font-mono text-neutral-400">Batch Processing</span>
          </div>

          <form onSubmit={handleRunBatchGrading} className="space-y-4">
            
            {/* SAFETY GUARDRAIL WARNING CARD */}
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-950 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-black uppercase text-[10px] text-amber-900 tracking-wider">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Safety Guardrail Enforced</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-snug font-medium">
                AI Auto-Grader strictly acts as a <strong>double-checking & verification tool</strong> for papers <strong>already corrected by a human teacher</strong> (with red/pen ticks, crosses, or scores). Fresh/uncorrected papers will be blocked.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                Exam Title / Subject *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Science Quiz - Unit 2"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                className="w-full text-xs border-2 border-neutral-900 rounded p-2.5 outline-none font-bold placeholder-neutral-400 focus:bg-neutral-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Maximum Score *
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  required
                  value={maxScore}
                  onChange={(e) => setMaxScore(Number(e.target.value))}
                  className="w-full text-xs border-2 border-neutral-900 rounded p-2.5 outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                  Roster Size
                </label>
                <div className="text-xs border-2 border-neutral-200 rounded p-2.5 bg-neutral-100 font-mono font-bold text-neutral-700">
                  {students.length} Enrolled
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                Answer Key / Criteria <span className="text-neutral-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Q1: Cell Wall, Q2: 46 chromosomes, Q3: Photosynthesis formula..."
                value={answerKey}
                onChange={(e) => setAnswerKey(e.target.value)}
                className="w-full text-xs border border-neutral-300 rounded p-2 outline-none font-sans focus:border-neutral-900 placeholder-neutral-400 resize-none"
              />
            </div>

            {/* Image Picker Dropzone */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                Select Test Paper Photos
              </label>
              <div className="relative border-2 border-dashed border-neutral-300 rounded hover:border-neutral-900 transition-colors p-4 text-center cursor-pointer bg-neutral-50">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isGrading}
                />
                <div className="space-y-1">
                  <Upload className="w-5 h-5 mx-auto text-neutral-400" />
                  <p className="text-[11px] font-bold text-neutral-900">Click or drop multiple test papers</p>
                  <p className="text-[9px] text-neutral-400 font-mono">JPG, PNG (Auto-compressed for fast grading)</p>
                </div>
              </div>
            </div>

            {/* Uploaded Images Previews Grid */}
            {uploadedImages.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-neutral-400">
                  <span>Selected Test Papers ({uploadedImages.length})</span>
                  <button
                    type="button"
                    onClick={() => setUploadedImages([])}
                    className="text-red-500 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto border border-neutral-200 rounded p-1.5 bg-white">
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded border border-neutral-200 overflow-hidden bg-neutral-50">
                      <img src={img} alt="test paper" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setUploadedImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-0.5 right-0.5 bg-red-600 text-white p-0.5 rounded-full hover:bg-red-700 cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error banner */}
            {gradingError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{gradingError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isGrading || uploadedImages.length === 0 || !examTitle.trim()}
              className={`w-full py-2.5 rounded border-2 border-neutral-950 font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 ${
                isGrading || uploadedImages.length === 0 || !examTitle.trim()
                  ? 'bg-neutral-100 border-neutral-300 text-neutral-400 cursor-not-allowed shadow-none translate-x-0.5 translate-y-0.5'
                  : 'bg-neutral-950 text-white'
              }`}
            >
              {isGrading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>
                    Auditing Paper {gradingProgress?.current} of {gradingProgress?.total}...
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Double-Check Teacher Marks ({uploadedImages.length})</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* RIGHT PANEL: CLASS MARKSHEET SPREADSHEET TABLE & STATS */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* STATS OVERVIEW CARDS */}
          {activeExam && activeExam.gradedPapers.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border-2 border-neutral-900 rounded-lg p-3 space-y-0.5">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Class Average</span>
                <div className="text-xl font-black text-neutral-900 font-mono">{averageScore}%</div>
              </div>

              <div className="bg-white border-2 border-neutral-900 rounded-lg p-3 space-y-0.5">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Highest Score</span>
                <div className="text-xl font-black text-emerald-600 font-mono">
                  {highestScore} / {activeExam.maxScore}
                </div>
              </div>

              <div className="bg-white border-2 border-neutral-900 rounded-lg p-3 space-y-0.5">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Pass Rate (≥40%)</span>
                <div className="text-xl font-black text-sky-600 font-mono">{passRate}%</div>
              </div>

              <div className="bg-white border-2 border-neutral-900 rounded-lg p-3 space-y-0.5">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Graded Papers</span>
                <div className="text-xl font-black text-neutral-900 font-mono">
                  {activeExam.gradedPapers.length} / {students.length}
                </div>
              </div>
            </div>
          )}

          {/* SPREADSHEET TOOLBAR & FILTERS */}
          <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              
              {/* Exam Title badge */}
              <div className="flex items-center gap-2 min-w-0">
                <Table className="w-4 h-4 text-emerald-600 shrink-0" />
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 truncate">
                  {activeExam ? activeExam.examTitle : 'Class Marksheet Spreadsheet'}
                </h3>
              </div>

              {/* Action Buttons: Export CSV, Print, & Run Anti-Cheat */}
              {activeExam && activeExam.gradedPapers.length > 0 && (
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={() => runCheatingDetection(activeExam.examTitle, activeExam.gradedPapers, activeExam.id)}
                    disabled={isDetectingCheating}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-neutral-200 text-neutral-950 font-bold text-xs rounded flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm border border-neutral-900"
                    title="Cross-reference graded papers with active seating map to detect cheating between bench-mates"
                  >
                    {isDetectingCheating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5 text-neutral-950" />
                        <span>Run Anti-Cheat Scan</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    title="Export Class Spreadsheet as CSV"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    onClick={handlePrint}
                    className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border border-neutral-300 rounded font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Print Class Marksheet"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                </div>
              )}
            </div>

            {/* Cheating Notice Banner */}
            {cheatingNotice && (
              <div className={`p-3 rounded-lg border text-xs font-medium flex items-center justify-between gap-2 ${
                cheatingNotice.includes('🚨')
                  ? 'bg-amber-50 border-amber-900 text-amber-950'
                  : 'bg-emerald-50 border-emerald-900 text-emerald-950'
              }`}>
                <div className="flex items-center gap-2">
                  <ShieldAlert className={`w-4 h-4 shrink-0 ${cheatingNotice.includes('🚨') ? 'text-amber-700' : 'text-emerald-700'}`} />
                  <span>{cheatingNotice}</span>
                </div>
                <button
                  onClick={() => setCheatingNotice(null)}
                  className="text-neutral-500 hover:text-neutral-900 font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Filter Tabs & Search Bar */}
            {activeExam && activeExam.gradedPapers.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-neutral-100">
                
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search by student name or roll number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-1.5 border border-neutral-300 rounded outline-none focus:border-neutral-900 font-medium"
                  />
                </div>

                {/* Status Segment Filters */}
                <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded border border-neutral-200 shrink-0">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded uppercase cursor-pointer ${
                      statusFilter === 'all' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    All ({activeExam.gradedPapers.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('graded')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded uppercase cursor-pointer ${
                      statusFilter === 'graded' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    Matched ({activeExam.gradedPapers.filter((p) => p.status === 'graded').length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('unmatched')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded uppercase cursor-pointer ${
                      statusFilter === 'unmatched' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    Unmatched ({activeExam.gradedPapers.filter((p) => p.status === 'unmatched').length})
                  </button>
                </div>
              </div>
            )}

            {/* SPREADSHEET DATA TABLE */}
            {!activeExam || activeExam.gradedPapers.length === 0 ? (
              <div className="border-2 border-dashed border-neutral-200 rounded-lg p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-neutral-50 border border-neutral-200 flex items-center justify-center mx-auto text-neutral-400">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div className="max-w-sm mx-auto space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900">No Graded Test Papers Yet</h4>
                  <p className="text-[11px] text-neutral-500">
                    Enter an exam title and upload test paper pictures on the left. Gemini will extract student names, verify against your roster, and populate this marksheet table!
                  </p>
                </div>
              </div>
            ) : filteredPapers.length === 0 ? (
              <div className="border border-dashed border-neutral-200 rounded-lg p-8 text-center text-xs text-neutral-500">
                No students match your search or filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-900 text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                      <th className="p-2.5 border-r border-neutral-800">Roll No</th>
                      <th className="p-2.5 border-r border-neutral-800">Assigned Student (Roster)</th>
                      <th className="p-2.5 border-r border-neutral-800">Name on Paper</th>
                      <th className="p-2.5 border-r border-neutral-800 text-center">Audit Status</th>
                      <th className="p-2.5 border-r border-neutral-800 text-center">Score</th>
                      <th className="p-2.5 border-r border-neutral-800 text-center">Grade</th>
                      <th className="p-2.5 border-r border-neutral-800">Gemini Remarks</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 text-xs font-sans bg-white">
                    {filteredPapers.map((paper) => (
                      <tr key={paper.id} className="hover:bg-neutral-50/80 transition-colors">
                        
                        {/* Roll Number */}
                        <td className="p-2.5 font-mono text-[11px] font-bold text-neutral-600">
                          {paper.rollNumber || 'N/A'}
                        </td>

                        {/* Roster Student Selector */}
                        <td className="p-2.5 font-bold text-neutral-900">
                          <div className="flex items-center gap-1.5">
                            {paper.status === 'graded' ? (
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            )}
                            <select
                              value={paper.matchedStudentId || ''}
                              onChange={(e) => handleAssignStudent(paper.id, e.target.value)}
                              className={`text-xs border font-bold rounded py-1 px-1.5 outline-none cursor-pointer max-w-[170px] truncate ${
                                paper.status === 'graded'
                                  ? 'bg-emerald-50/50 border-emerald-300 text-emerald-950'
                                  : 'bg-amber-50/50 border-amber-300 text-amber-950'
                              }`}
                            >
                              <option value="">-- Unmatched ({paper.detectedName}) --</option>
                              {students.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.rollNumber || 'No Roll'})
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* OCR Name on Paper */}
                        <td className="p-2.5 text-neutral-600 font-mono text-[11px]">
                          "{paper.detectedName}"
                        </td>

                        {/* Audit Status Badge */}
                        <td className="p-2.5 text-center">
                          {paper.status === 'uncorrected_guardrail_blocked' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-red-100 text-red-900 border border-red-300">
                              <ShieldAlert className="w-2.5 h-2.5 text-red-600" />
                              Uncorrected (Blocked)
                            </span>
                          ) : paper.teacherGradingAudit?.hasTeacherDiscrepancy ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-950 border border-amber-300">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                              Teacher Mistake Flagged
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-950 border border-emerald-300">
                              <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                              Verified Correct
                            </span>
                          )}
                        </td>

                        {/* Score Obtained */}
                        <td className="p-2.5 text-center font-mono font-black text-neutral-950">
                          {paper.score} / {paper.maxScore}
                          <span className="block text-[9px] text-neutral-400 font-normal">({paper.percentage}%)</span>
                        </td>

                        {/* Grade Badge */}
                        <td className="p-2.5 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-black font-mono border ${
                              paper.percentage >= 80
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : paper.percentage >= 60
                                ? 'bg-sky-100 text-sky-900 border-sky-300'
                                : paper.percentage >= 40
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-red-100 text-red-900 border-red-300'
                            }`}
                          >
                            {paper.grade}
                          </span>
                        </td>

                        {/* Feedback */}
                        <td className="p-2.5 text-[11px] text-neutral-600 max-w-xs truncate" title={paper.overallFeedback}>
                          {paper.overallFeedback}
                        </td>

                        {/* Actions */}
                        <td className="p-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setInspectedPaper(paper)}
                              className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded text-[10px] font-bold text-neutral-800 flex items-center gap-1 transition-colors cursor-pointer"
                              title="Inspect Test Paper Image & Item Corrections"
                            >
                              <Eye className="w-3 h-3 text-sky-600" />
                              <span>Inspect</span>
                            </button>

                            <button
                              onClick={() => handleDeletePaper(paper.id)}
                              className="p-1 text-neutral-400 hover:text-red-600 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                              title="Remove entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* INSPECTION & ITEMIZED CORRECTIONS MODAL */}
      {inspectedPaper && (
        <div className="fixed inset-0 z-50 bg-neutral-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-neutral-900 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
            
            {/* Modal Header */}
            <div className="bg-neutral-900 text-white p-4 flex items-center justify-between border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Test Paper Corrections — {inspectedPaper.matchedStudentName}
                  </h3>
                  <p className="text-[10px] font-mono text-neutral-400">
                    Detected Name: "{inspectedPaper.detectedName}" • Score: {inspectedPaper.score}/{inspectedPaper.maxScore} ({inspectedPaper.percentage}%)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectedPaper(null)}
                className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content: Side-by-Side Image and Item Breakdown */}
            <div className="p-5 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Paper Photo */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 block">Uploaded Test Paper Image</span>
                {inspectedPaper.imageUri ? (
                  <div className="border border-neutral-300 rounded overflow-hidden bg-neutral-900 flex items-center justify-center max-h-[500px]">
                    <img src={inspectedPaper.imageUri} alt="Test Paper scan" className="max-h-[480px] w-auto object-contain" />
                  </div>
                ) : (
                  <div className="border border-dashed border-neutral-300 rounded p-8 text-center text-xs text-neutral-400">
                    No image file stored for this paper.
                  </div>
                )}
              </div>

              {/* Itemized Corrections & Remarks */}
              <div className="space-y-4">
                
                {/* SAFETY GUARDRAIL & TEACHER AUDIT SUMMARY BOX */}
                {inspectedPaper.status === 'uncorrected_guardrail_blocked' || inspectedPaper.isTeacherCorrected === false ? (
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3.5 space-y-2 text-red-950">
                    <div className="flex items-center gap-2 font-black uppercase text-xs text-red-900 tracking-wider">
                      <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Safety Guardrail Blocked</span>
                    </div>
                    <p className="text-xs text-red-800 leading-relaxed font-medium">
                      {inspectedPaper.guardrailMessage || 'This test paper has NOT been corrected by the human teacher yet. The AI Auto-Grader is strictly restricted to double-checking papers that have already been corrected by a human teacher.'}
                    </p>
                  </div>
                ) : (
                  <div className={`border-2 rounded-lg p-3.5 space-y-2 ${
                    inspectedPaper.teacherGradingAudit?.hasTeacherDiscrepancy 
                      ? 'bg-amber-50/90 border-amber-400 text-amber-950' 
                      : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                  }`}>
                    <div className="flex items-center justify-between border-b border-black/10 pb-2">
                      <div className="flex items-center gap-2 font-black uppercase text-xs tracking-wider">
                        {inspectedPaper.teacherGradingAudit?.hasTeacherDiscrepancy ? (
                          <>
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Teacher Grading Discrepancy Detected</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Teacher Marking 100% Verified</span>
                          </>
                        )}
                      </div>
                      
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/80 border border-black/10">
                        Audit Complete
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-white/80 p-2 rounded border border-black/10">
                        <span className="text-[9px] font-sans uppercase font-bold text-neutral-500 block">Teacher Written Score</span>
                        <span className="font-black text-neutral-900 text-sm">
                          {inspectedPaper.teacherGradingAudit?.humanTeacherScore !== null && inspectedPaper.teacherGradingAudit?.humanTeacherScore !== undefined
                            ? `${inspectedPaper.teacherGradingAudit.humanTeacherScore} / ${inspectedPaper.maxScore}`
                            : 'Score detected on paper'}
                        </span>
                      </div>

                      <div className="bg-white/80 p-2 rounded border border-black/10">
                        <span className="text-[9px] font-sans uppercase font-bold text-neutral-500 block">AI Verified Audit Score</span>
                        <span className="font-black text-emerald-700 text-sm">
                          {inspectedPaper.score} / {inspectedPaper.maxScore}
                        </span>
                      </div>
                    </div>

                    {inspectedPaper.teacherGradingAudit?.teacherMistakesFound && inspectedPaper.teacherGradingAudit.teacherMistakesFound.length > 0 && (
                      <div className="pt-1 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block">Teacher Mistakes / Audit Notes:</span>
                        <ul className="list-disc list-inside text-xs space-y-0.5 text-amber-950 font-medium">
                          {inspectedPaper.teacherGradingAudit.teacherMistakesFound.map((mistake, mIdx) => (
                            <li key={mIdx}>{mistake}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Overall Feedback */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-neutral-400 block">Overall Performance Summary</span>
                  <p className="text-xs text-neutral-800 leading-relaxed font-medium">
                    {inspectedPaper.overallFeedback}
                  </p>
                </div>

                {/* Question Breakdown List */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 block">
                    Itemized Question Corrections ({inspectedPaper.questionBreakdown.length} Items)
                  </span>

                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {inspectedPaper.questionBreakdown.map((q, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded border text-xs space-y-1 ${
                          q.isCorrect
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-red-50/40 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-1.5 text-neutral-900">
                            {q.isCorrect ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            )}
                            Question {q.questionNumber}
                          </span>
                          <span className="font-mono text-[11px] text-neutral-700">
                            {q.marksAwarded} / {q.maxMarks} pts
                          </span>
                        </div>

                        <div className="text-neutral-700 space-y-0.5 pl-5">
                          <p>
                            <span className="font-semibold text-neutral-500">Student Answer:</span> "{q.studentAnswer}"
                          </p>
                          {q.correctAnswer && (
                            <p>
                              <span className="font-semibold text-emerald-700">Correct Answer:</span> "{q.correctAnswer}"
                            </p>
                          )}
                          {q.feedback && (
                            <p className="text-[11px] text-neutral-500 italic mt-1">
                              Note: {q.feedback}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-neutral-50 border-t border-neutral-200 p-3 flex justify-end">
              <button
                onClick={() => setInspectedPaper(null)}
                className="px-4 py-1.5 bg-neutral-900 text-white hover:bg-neutral-800 rounded font-bold text-xs cursor-pointer"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
