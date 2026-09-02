import React, { useState, useEffect } from 'react';
import { Student, ClassroomLayout, SeatingStrategyMode, SeatingRule, SeatingHarmonyAnalysis, SeatAssignment, CheatingAlert } from '../types';
import { subscribeToClassroomLayout, DEFAULT_CLASSROOM_LAYOUT } from '../services/classroomService';
import {
  subscribeToSeatingArrangement,
  saveActiveSeatingArrangement,
  subscribeToCheatingAlerts,
  updateCheatingAlertStatus,
  deleteCheatingAlert
} from '../services/seatingService';
import {
  Sparkles,
  Grid,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  HelpCircle,
  Users,
  RotateCcw,
  DoorOpen,
  Monitor,
  UserCheck,
  Zap,
  ShieldCheck,
  UserPlus,
  Lock,
  ArrowLeftRight,
  Printer,
  CheckCircle2,
  SlidersHorizontal,
  Plus,
  Trash2,
  Award,
  BookOpen,
  Eye,
  HeartHandshake,
  Brain,
  Cloud,
  Check
} from 'lucide-react';

interface ReasoningItem {
  studentName: string;
  explanation: string;
}

interface SeatingArrangementProps {
  students: Student[];
}

export const SeatingArrangement: React.FC<SeatingArrangementProps> = ({ students }) => {
  const [assignments, setAssignments] = useState<SeatAssignment[]>([]);
  const [reasoning, setReasoning] = useState<ReasoningItem[]>([]);
  const [harmonyAnalysis, setHarmonyAnalysis] = useState<SeatingHarmonyAnalysis | null>(null);
  const [strategy, setStrategy] = useState<SeatingStrategyMode>('behavioral');
  const [customRules, setCustomRules] = useState<SeatingRule[]>([]);
  const [cheatingAlerts, setCheatingAlerts] = useState<CheatingAlert[]>([]);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showCheatingModal, setShowCheatingModal] = useState<boolean>(false);
  
  // Rule creation state
  const [ruleType, setRuleType] = useState<'separate' | 'pair' | 'lock'>('separate');
  const [ruleStudent1, setRuleStudent1] = useState<string>('');
  const [ruleStudent2, setRuleStudent2] = useState<string>('');
  const [ruleBenchId, setRuleBenchId] = useState<string>('');
  const [ruleSeat, setRuleSeat] = useState<'Left' | 'Right'>('Left');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSavingFirebase, setIsSavingFirebase] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [selectedSeat, setSelectedSeat] = useState<SeatAssignment | null>(null);
  const [swapSourceSeat, setSwapSourceSeat] = useState<SeatAssignment | null>(null);
  const [layout, setLayout] = useState<ClassroomLayout>(DEFAULT_CLASSROOM_LAYOUT);
  const [notification, setNotification] = useState<string | null>(null);

  // Subscribe to real-time classroom layout settings
  useEffect(() => {
    const unsubscribe = subscribeToClassroomLayout(
      (updatedLayout) => {
        setLayout(updatedLayout);
      },
      (err) => {
        console.error('Error listening to classroom layout in Seating:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  // Subscribe to real-time seating arrangement from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToSeatingArrangement(
      (savedData) => {
        if (savedData) {
          if (Array.isArray(savedData.assignments)) setAssignments(savedData.assignments);
          if (Array.isArray(savedData.customRules)) setCustomRules(savedData.customRules);
          if (savedData.strategy) setStrategy(savedData.strategy);
          if (savedData.harmonyAnalysis) setHarmonyAnalysis(savedData.harmonyAnalysis);
          if (Array.isArray(savedData.reasoning)) setReasoning(savedData.reasoning);
        }
      },
      (err) => {
        console.error('Firestore seating arrangement subscription error:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  // Subscribe to live Cheating Alerts from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToCheatingAlerts(
      (alerts) => {
        setCheatingAlerts(alerts);
      },
      (err) => {
        console.error('Firestore cheating alerts subscription error:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleGenerateSeating = async () => {
    if (students.length === 0) {
      setError('Please enroll some students first before generating a seating plan.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSelectedSeat(null);
    setSwapSourceSeat(null);

    try {
      const response = await fetch('/api/seating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          students, 
          classroomLayout: layout,
          strategy,
          customRules 
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server returned an error generating seating arrangement.');
      }

      const data = await response.json();
      const newAssignments = data.assignments || [];
      const newReasoning = data.reasoning || [];
      const newHarmony = data.harmonyAnalysis || null;

      setAssignments(newAssignments);
      setReasoning(newReasoning);
      setHarmonyAnalysis(newHarmony);

      // Save to Firebase Firestore
      setIsSavingFirebase(true);
      await saveActiveSeatingArrangement({
        assignments: newAssignments,
        customRules,
        strategy,
        harmonyAnalysis: newHarmony,
        reasoning: newReasoning,
      });
      showToast('New AI Seating Arrangement saved to Firebase!');
    } catch (err: any) {
      console.error('Failed to generate seating plan:', err);
      setError(err.message || 'An unexpected error occurred. Please make sure GEMINI_API_KEY is configured.');
    } finally {
      setIsLoading(false);
      setIsSavingFirebase(false);
    }
  };

  const handleAddRule = async () => {
    if (!ruleStudent1) return;
    if ((ruleType === 'separate' || ruleType === 'pair') && !ruleStudent2) return;
    if (ruleType === 'separate' && ruleStudent1 === ruleStudent2) return;
    if (ruleType === 'lock' && !ruleBenchId) return;

    const newRule: SeatingRule = {
      id: `rule-${Date.now()}`,
      type: ruleType,
      student1Id: ruleStudent1,
      student2Id: ruleType !== 'lock' ? ruleStudent2 : undefined,
      benchId: ruleType === 'lock' ? ruleBenchId : undefined,
      seat: ruleType === 'lock' ? ruleSeat : undefined,
    };

    const updatedRules = [...customRules, newRule];
    setCustomRules(updatedRules);
    setRuleStudent1('');
    setRuleStudent2('');

    // Save rules to Firestore
    await saveActiveSeatingArrangement({ customRules: updatedRules });
    showToast('Teacher mandate saved in Firebase!');
  };

  const handleRemoveRule = async (id: string) => {
    const updatedRules = customRules.filter(r => r.id !== id);
    setCustomRules(updatedRules);
    await saveActiveSeatingArrangement({ customRules: updatedRules });
    showToast('Mandate removed & saved to Firebase.');
  };

  // Enforce mandatory separation rule from cheating alert
  const handleEnforceSeparation = async (alert: CheatingAlert) => {
    const s1 = students.find(s => s.id === alert.student1Id)?.name || alert.student1Name;
    const s2 = students.find(s => s.id === alert.student2Id)?.name || alert.student2Name;

    // Check if rule already exists
    const exists = customRules.some(
      r => r.type === 'separate' &&
      ((r.student1Id === alert.student1Id && r.student2Id === alert.student2Id) ||
       (r.student1Id === alert.student2Id && r.student2Id === alert.student1Id))
    );

    let updatedRules = [...customRules];
    if (!exists) {
      const newRule: SeatingRule = {
        id: `rule-cheating-${Date.now()}`,
        type: 'separate',
        student1Id: alert.student1Id,
        student2Id: alert.student2Id,
      };
      updatedRules.push(newRule);
      setCustomRules(updatedRules);
    }

    // Update alert status in Firestore
    await updateCheatingAlertStatus(alert.id, 'separated');
    // Save rules to Firestore
    await saveActiveSeatingArrangement({ customRules: updatedRules });

    showToast(`Mandatory separation rule added for ${s1} & ${s2}! Re-run AI Seating to apply.`);
  };

  const handleDismissAlert = async (alertId: string) => {
    await updateCheatingAlertStatus(alertId, 'dismissed');
    showToast('Cheating alert dismissed.');
  };

  const handleDeleteAlertDoc = async (alertId: string) => {
    await deleteCheatingAlert(alertId);
    showToast('Cheating warning cleared.');
  };

  // Manual seat swap / move logic with Firebase persistence
  const handleSwapSeats = async (targetSeat: SeatAssignment) => {
    if (!swapSourceSeat) {
      setSwapSourceSeat(targetSeat);
      return;
    }

    if (swapSourceSeat.benchId === targetSeat.benchId && swapSourceSeat.seat === targetSeat.seat) {
      setSwapSourceSeat(null);
      return;
    }

    // Swap assignment array elements
    const updatedAssignments = assignments.map(a => {
      if (a.benchId === swapSourceSeat.benchId && a.seat === swapSourceSeat.seat) {
        return { ...a, studentId: targetSeat.studentId, studentName: targetSeat.studentName };
      }
      if (a.benchId === targetSeat.benchId && a.seat === targetSeat.seat) {
        return { ...a, studentId: swapSourceSeat.studentId, studentName: swapSourceSeat.studentName };
      }
      return a;
    });

    setAssignments(updatedAssignments);
    setSwapSourceSeat(null);

    // Persist manual layout modification to Firestore immediately!
    await saveActiveSeatingArrangement({ assignments: updatedAssignments });
    showToast('Manual seating adjustment saved to Firebase!');
  };

  // Assign specific student directly to seat (manual placement)
  const handleDirectAssignStudent = async (benchId: string, seat: 'Left' | 'Right', studentId: string) => {
    const matchedStudent = students.find(s => s.id === studentId);
    const newStudentName = matchedStudent ? matchedStudent.name : 'Empty';
    const newStudentId = matchedStudent ? matchedStudent.id : 'Empty';

    // If student was previously seated elsewhere, clear that seat
    let updatedAssignments = assignments.map(a => {
      if (newStudentId !== 'Empty' && a.studentId === newStudentId) {
        return { ...a, studentId: 'Empty', studentName: 'Empty' };
      }
      return a;
    });

    // Assign to target bench and seat
    const targetIndex = updatedAssignments.findIndex(a => a.benchId === benchId && a.seat === seat);
    if (targetIndex >= 0) {
      updatedAssignments[targetIndex] = {
        benchId,
        seat,
        studentId: newStudentId,
        studentName: newStudentName
      };
    } else {
      updatedAssignments.push({
        benchId,
        seat,
        studentId: newStudentId,
        studentName: newStudentName
      });
    }

    setAssignments(updatedAssignments);

    // Save to Firestore
    await saveActiveSeatingArrangement({ assignments: updatedAssignments });
    showToast(`Manual assignment updated for ${newStudentName}! Saved in Firebase.`);
  };

  const handleReset = async () => {
    setAssignments([]);
    setReasoning([]);
    setHarmonyAnalysis(null);
    setSelectedSeat(null);
    setSwapSourceSeat(null);
    setError('');

    // Clear active arrangement in Firestore
    await saveActiveSeatingArrangement({
      assignments: [],
      harmonyAnalysis: null,
      reasoning: []
    });
    showToast('Seating layout cleared in Firebase.');
  };

  const handlePrintLayout = () => {
    window.print();
  };

  const getStudentById = (id: string): Student | undefined => {
    return students.find((s) => s.id === id);
  };

  const getAssignmentAtBench = (benchId: string, seat: 'Left' | 'Right'): SeatAssignment | undefined => {
    return assignments.find((a) => a.benchId === benchId && a.seat === seat);
  };

  const getExplanationForStudent = (name: string): string => {
    const item = reasoning.find((r) => r.studentName.toLowerCase() === name.toLowerCase());
    return item ? item.explanation : '';
  };

  const getBenchInsight = (benchId: string) => {
    return harmonyAnalysis?.benchInsights?.find(b => b.benchId === benchId);
  };

  // Find active cheating alert for a given bench
  const getBenchCheatingAlert = (benchId: string): CheatingAlert | undefined => {
    return cheatingAlerts.find(a => a.benchId === benchId && a.status === 'active_warning');
  };

  const activeWarningsCount = cheatingAlerts.filter(a => a.status === 'active_warning').length;

  const strategiesList: { id: SeatingStrategyMode; title: string; desc: string; icon: any }[] = [
    { id: 'behavioral', title: 'Focus & Behavior', desc: 'Separate talkative students & reduce window/door distractions', icon: Brain },
    { id: 'peer_tutoring', title: 'Peer Tutoring', desc: 'Pair high-performing helpers with struggling learners', icon: HeartHandshake },
    { id: 'exam_anti_cheat', title: 'Exam / Quiz Mode', desc: 'Maximize physical separation between seats', icon: ShieldCheck },
    { id: 'gender_balanced', title: 'Gender Balance', desc: 'Even male and female seating distribution', icon: Users },
    { id: 'social_mixing', title: 'Social Integration', desc: 'Mix up existing cliques and foster new friendships', icon: UserPlus },
  ];

  return (
    <div className="bg-white border border-neutral-900 rounded-lg p-5 shadow-[2px_2px_0px_rgba(0,0,0,1)] space-y-5">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="p-2.5 bg-neutral-900 text-white rounded border border-neutral-950 text-xs font-bold flex items-center justify-between shadow-md animate-fade-in">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-emerald-400" />
            <span>{notification}</span>
          </div>
          <span className="text-[10px] text-neutral-400 font-mono">Firebase Synced</span>
        </div>
      )}

      {/* Cheating Alert Global Banner (When alerts exist) */}
      {activeWarningsCount > 0 && (
        <div className="p-3.5 bg-red-600 text-white rounded-lg border-2 border-red-950 shadow-[2px_2px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-300 shrink-0" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                ⚠️ Academic Integrity Alert ({activeWarningsCount} Cheating Flags)
              </h4>
              <p className="text-[11px] text-red-100 mt-0.5">
                Adjacent seated students scored identical wrong answers during test paper grading. Review & enforce separation!
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCheatingModal(true)}
            className="px-3.5 py-1.5 bg-white text-red-950 font-black text-xs uppercase tracking-wider rounded border border-red-950 hover:bg-red-50 cursor-pointer shrink-0 shadow-sm"
          >
            Review Cheating Warnings ({activeWarningsCount})
          </button>
        </div>
      )}

      {/* Title Bar & Control Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3.5 border-b border-neutral-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-neutral-900 flex items-center justify-center text-white shadow-sm">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-950 uppercase tracking-wide flex items-center gap-2">
              Smart Classroom Seating Planner
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono font-bold lowercase flex items-center gap-1">
                <Cloud className="w-2.5 h-2.5" /> Firebase Live
              </span>
            </h2>
            <p className="text-[11px] text-neutral-500">
              Intentional layout optimizer with manual seating editing, anti-cheating mandates & Firebase persistence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap">
          <button
            onClick={() => setShowRulesModal(!showRulesModal)}
            className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-semibold rounded border border-neutral-900 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> 
            Mandates {customRules.length > 0 && `(${customRules.length})`}
          </button>

          {cheatingAlerts.length > 0 && (
            <button
              onClick={() => setShowCheatingModal(true)}
              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-950 text-xs font-bold rounded border border-red-900 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-600" /> 
              Cheating Alerts ({cheatingAlerts.length})
            </button>
          )}

          {assignments.length > 0 && (
            <>
              <button
                onClick={handlePrintLayout}
                className="px-3 py-1.5 bg-white hover:bg-neutral-50 text-neutral-900 text-xs font-semibold rounded border border-neutral-900 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 bg-white hover:bg-neutral-50 text-neutral-900 text-xs font-semibold rounded border border-neutral-900 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Clear
              </button>
            </>
          )}

          <button
            onClick={handleGenerateSeating}
            disabled={isLoading || students.length === 0}
            className="flex-1 sm:flex-none px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:border-neutral-200 text-white font-bold text-xs uppercase tracking-wide rounded border border-neutral-900 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" /> Calculating...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Calculate Smart Seating
              </>
            )}
          </button>
        </div>
      </div>

      {/* Strategy Selection Pills Bar */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider block">
          Select Seating Strategy Mode:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {strategiesList.map((st) => {
            const IconComponent = st.icon;
            const isSelected = strategy === st.id;
            return (
              <button
                key={st.id}
                onClick={async () => {
                  setStrategy(st.id);
                  await saveActiveSeatingArrangement({ strategy: st.id });
                }}
                className={`p-2.5 rounded border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-neutral-950 text-white border-neutral-950 shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                    : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-neutral-600'}`} />
                  <span className="text-[11px] font-bold leading-tight">{st.title}</span>
                </div>
                <p className={`text-[9px] leading-snug line-clamp-2 ${isSelected ? 'text-neutral-300' : 'text-neutral-500'}`}>
                  {st.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Rules Mandates Modal */}
      {showRulesModal && (
        <div className="p-4 bg-neutral-50 border border-neutral-900 rounded-lg space-y-4 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wide flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-neutral-700" />
              Custom Teacher Mandates & Anti-Cheating Rules
            </h3>
            <span className="text-[10px] text-neutral-500">
              Rules are given top priority over AI strategies and saved in Firebase
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-[10px] font-bold text-neutral-600 block mb-1">Rule Type</label>
              <select
                value={ruleType}
                onChange={(e: any) => setRuleType(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-neutral-300 rounded font-medium focus:ring-1 focus:ring-neutral-900"
              >
                <option value="separate">🛑 Must Separate Students</option>
                <option value="pair">👥 Must Seat Together (Pair)</option>
                <option value="lock">📌 Fixed Seat Lock</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-neutral-600 block mb-1">Student 1</label>
              <select
                value={ruleStudent1}
                onChange={(e) => setRuleStudent1(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-neutral-300 rounded font-medium focus:ring-1 focus:ring-neutral-900"
              >
                <option value="">Select Student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {ruleType !== 'lock' ? (
              <div>
                <label className="text-[10px] font-bold text-neutral-600 block mb-1">Student 2</label>
                <select
                  value={ruleStudent2}
                  onChange={(e) => setRuleStudent2(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-neutral-300 rounded font-medium focus:ring-1 focus:ring-neutral-900"
                >
                  <option value="">Select Student...</option>
                  {students.filter(s => s.id !== ruleStudent1).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="text-[10px] font-bold text-neutral-600 block mb-1">Bench</label>
                  <select
                    value={ruleBenchId}
                    onChange={(e) => setRuleBenchId(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-neutral-300 rounded font-medium"
                  >
                    <option value="">Bench...</option>
                    {(layout.benches || []).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-600 block mb-1">Seat</label>
                  <select
                    value={ruleSeat}
                    onChange={(e: any) => setRuleSeat(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-neutral-300 rounded font-medium"
                  >
                    <option value="Left">Left</option>
                    <option value="Right">Right</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-end">
              <button
                onClick={handleAddRule}
                disabled={!ruleStudent1}
                className="w-full p-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white text-xs font-bold rounded border border-neutral-900 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Save Mandate
              </button>
            </div>
          </div>

          {/* Active Rules List */}
          {customRules.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-neutral-200">
              <span className="text-[10px] font-bold text-neutral-500 uppercase">Active Seating Mandates:</span>
              <div className="flex flex-wrap gap-2">
                {customRules.map((rule) => {
                  const s1 = students.find(s => s.id === rule.student1Id)?.name || rule.student1Id;
                  const s2 = students.find(s => s.id === rule.student2Id)?.name || rule.student2Id;
                  const bName = layout.benches?.find(b => b.id === rule.benchId)?.name || rule.benchId;

                  return (
                    <div
                      key={rule.id}
                      className="px-2.5 py-1 bg-white border border-neutral-900 rounded text-[11px] font-medium flex items-center gap-2 shadow-xs"
                    >
                      {rule.type === 'separate' && (
                        <span className="text-red-700 font-bold flex items-center gap-1">
                          🛑 Keep <strong className="text-neutral-900">{s1}</strong> & <strong className="text-neutral-900">{s2}</strong> separated
                        </span>
                      )}
                      {rule.type === 'pair' && (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          👥 Pair <strong className="text-neutral-900">{s1}</strong> & <strong className="text-neutral-900">{s2}</strong>
                        </span>
                      )}
                      {rule.type === 'lock' && (
                        <span className="text-indigo-700 font-bold flex items-center gap-1">
                          📌 Lock <strong className="text-neutral-900">{s1}</strong> to {bName} ({rule.seat})
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoveRule(rule.id)}
                        className="text-neutral-400 hover:text-red-600 transition-colors ml-1 cursor-pointer"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cheating Warnings Modal */}
      {showCheatingModal && (
        <div className="fixed inset-0 z-50 bg-neutral-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-neutral-900 rounded-lg max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
            <div className="bg-red-950 text-white p-4 flex items-center justify-between border-b border-red-900">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Academic Integrity & Cheating Alerts
                  </h3>
                  <p className="text-[10px] text-red-200">
                    Flagged from AI Test Paper Grader analysis of seated neighbors
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCheatingModal(false)}
                className="text-red-200 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {cheatingAlerts.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 space-y-2">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                  <p className="text-xs font-bold">No cheating warnings flagged!</p>
                  <p className="text-[11px]">All student test paper answers appear unique across seating positions.</p>
                </div>
              ) : (
                cheatingAlerts.map((alert) => {
                  const isSeparated = alert.status === 'separated';

                  return (
                    <div
                      key={alert.id}
                      className={`p-3.5 rounded-lg border-2 space-y-2.5 ${
                        isSeparated
                          ? 'bg-neutral-50 border-neutral-300 opacity-75'
                          : 'bg-red-50 border-red-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-neutral-950">
                              {alert.student1Name} & {alert.student2Name}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-neutral-300 font-bold">
                              {alert.benchName}
                            </span>
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                              alert.suspicionLevel === 'high' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                            }`}>
                              {alert.similarityPercentage}% Similarity ({alert.suspicionLevel})
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                            Exam: "{alert.examTitle}" • Flagged at {new Date(alert.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <button
                          onClick={() => handleDeleteAlertDoc(alert.id)}
                          className="text-neutral-400 hover:text-red-600 cursor-pointer p-1"
                          title="Clear Alert"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-xs text-neutral-800 bg-white p-2.5 rounded border border-neutral-200 leading-relaxed font-medium">
                        {alert.summary}
                      </p>

                      {alert.identicalMistakes && alert.identicalMistakes.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-red-800">
                          <span className="font-bold">Matching Wrong Answers:</span>
                          {alert.identicalMistakes.map((m, idx) => (
                            <span key={idx} className="bg-red-100 px-1.5 py-0.5 rounded border border-red-200 font-bold">
                              {m}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-neutral-200">
                        {isSeparated ? (
                          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Separation Mandate Active in Firebase
                          </span>
                        ) : (
                          <button
                            onClick={() => handleEnforceSeparation(alert)}
                            className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded border border-neutral-950 flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                            Enforce Mandatory Separation Rule
                          </button>
                        )}

                        {!isSeparated && (
                          <button
                            onClick={() => handleDismissAlert(alert.id)}
                            className="text-[10px] text-neutral-500 hover:underline cursor-pointer"
                          >
                            Dismiss Flag
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="bg-neutral-100 border-t border-neutral-300 p-3 flex justify-end">
              <button
                onClick={() => setShowCheatingModal(false)}
                className="px-4 py-1.5 bg-neutral-900 text-white rounded text-xs font-bold cursor-pointer"
              >
                Close Alerts
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded bg-red-50 border border-red-900 text-red-900 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <div>
            <span className="font-bold">Error:</span> {error}
          </div>
        </div>
      )}

      {/* Harmony Analytics Score Header (When layout calculated) */}
      {harmonyAnalysis && (
        <div className="p-3.5 bg-neutral-950 text-white rounded-lg border border-neutral-900 shadow-[2px_2px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 font-mono font-black text-lg shrink-0">
              {harmonyAnalysis.overallScore}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Classroom Harmony Score</h4>
                <span className="text-[10px] text-neutral-400 font-mono">/ 100</span>
              </div>
              <p className="text-[11px] text-neutral-200 mt-0.5">
                {harmonyAnalysis.summary}
              </p>
            </div>
          </div>

          <div className="text-right text-[10px] font-mono text-neutral-400 shrink-0">
            <span>Strategy: <strong className="text-amber-300 uppercase">{strategy.replace('_', ' ')}</strong></span>
          </div>
        </div>
      )}

      {/* Manual Swap Floating Helper Banner */}
      {swapSourceSeat && (
        <div className="p-2.5 bg-amber-50 border border-amber-900 rounded text-amber-950 text-xs flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-amber-700" />
            <span>
              Swapping seat for <strong>{swapSourceSeat.studentName}</strong>. Click another seat to complete swap!
            </span>
          </div>
          <button
            onClick={() => setSwapSourceSeat(null)}
            className="text-xs font-bold underline cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Primary Layout Canvas */}
      {assignments.length === 0 ? (
        <div className="bg-neutral-50 border border-dashed border-neutral-300 rounded-lg p-10 text-center space-y-3">
          <div className="w-10 h-10 rounded border border-neutral-300 bg-white flex items-center justify-center mx-auto text-neutral-400">
            <Users className="w-5 h-5" />
          </div>
          <div className="max-w-xs mx-auto space-y-1">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">No Layout Arranged</h3>
            <p className="text-[11px] text-neutral-500 font-sans leading-relaxed">
              Select a strategy mode above and click <strong className="text-neutral-900">"Calculate Smart Seating"</strong>. Gemini will compute optimal seating.
            </p>
          </div>
          {students.length === 0 && (
            <p className="text-[10px] text-red-600 font-mono font-bold">
              * Enroll students first in Roster to generate seating maps.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Visual Classroom Grid Map */}
          <div className="space-y-4">
            {/* Dynamic classroom layout constraint bar */}
            <div className="bg-neutral-950 text-white shadow rounded p-3 text-center relative overflow-hidden space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-200 font-mono block">
                ★ CLASSROOM PHYSICAL LAYOUT CONFIGURATION ★
              </span>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[9px] font-mono text-neutral-400">
                <span className="flex items-center gap-1">
                  <Monitor className="w-3.5 h-3.5 text-neutral-300" />
                  BOARD: <strong className="text-white">{layout.smartBoardLocation} Wall</strong>
                </span>
                <span className="flex items-center gap-1">
                  <DoorOpen className="w-3.5 h-3.5 text-amber-400" />
                  DOORWAY: <strong className="text-white">{layout.doorLocation}</strong>
                </span>
                {layout.teacherDeskLocation !== 'None' && (
                  <span className="flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                    TEACHER DESK: <strong className="text-white">{layout.teacherDeskLocation}</strong>
                  </span>
                )}
                {layout.windowLocations && layout.windowLocations.length > 0 && (
                  <span className="flex items-center gap-1">
                    <span>🪟</span>
                    WINDOWS: <strong className="text-white">{layout.windowLocations.map(w => w.replace('-', ' ')).join(', ')}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Dynamic visual custom benches map */}
            <div 
              className="relative w-full aspect-[4/3] max-h-[480px] bg-neutral-50/50 border border-neutral-200 rounded-md overflow-hidden select-none"
              style={{
                backgroundImage: 'radial-gradient(circle, #e5e5e5 1.5px, transparent 1.5px)',
                backgroundSize: '20px 20px'
              }}
            >
              {/* North Label */}
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-[9px] font-black font-mono text-neutral-400 tracking-widest bg-white/80 px-2 py-0.5 rounded border border-neutral-200">
                ▲ FRONT / WHITEBOARD WALL
              </div>

              {/* Dynamic Benches Render */}
              {(layout.benches || []).map((bench) => {
                const leftSeat = getAssignmentAtBench(bench.id, 'Left');
                const rightSeat = getAssignmentAtBench(bench.id, 'Right');

                const leftStudent = leftSeat ? getStudentById(leftSeat.studentId) : undefined;
                const rightStudent = rightSeat ? getStudentById(rightSeat.studentId) : undefined;

                const insight = getBenchInsight(bench.id);
                const benchCheatingAlert = getBenchCheatingAlert(bench.id);

                return (
                  <div
                    key={bench.id}
                    className={`absolute w-[135px] bg-white border-2 rounded-lg p-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] select-none z-10 space-y-1.5 transition-all ${
                      benchCheatingAlert ? 'border-red-600 ring-2 ring-red-400 bg-red-50/30' : 'border-neutral-900'
                    }`}
                    style={{
                      left: `${bench.x}%`,
                      top: `${bench.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {/* Cheating Warning Badge on Bench */}
                    {benchCheatingAlert && (
                      <div 
                        onClick={() => setShowCheatingModal(true)}
                        className="bg-red-600 text-white text-[8px] font-black font-mono px-1.5 py-0.5 rounded flex items-center justify-between cursor-pointer animate-pulse"
                        title={benchCheatingAlert.summary}
                      >
                        <span className="flex items-center gap-1">
                          <ShieldAlert className="w-2.5 h-2.5 text-amber-300" /> CHEATING ALERT
                        </span>
                        <span>{benchCheatingAlert.similarityPercentage}%</span>
                      </div>
                    )}

                    {/* Bench Header & AI Badge */}
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-1">
                      <span className="text-[8px] font-mono font-black text-neutral-600 uppercase">
                        {bench.name}
                      </span>

                      {insight && !benchCheatingAlert && (
                        <span 
                          title={insight.description}
                          className={`text-[7px] font-bold px-1 py-0.2 rounded font-mono truncate max-w-[70px] ${
                            insight.type === 'optimal' 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                              : insight.type === 'warning'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          {insight.compatibilityLabel}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {/* Left Seat Slot */}
                      <div
                        onClick={() => {
                          if (swapSourceSeat) {
                            if (leftSeat) handleSwapSeats(leftSeat);
                            else handleSwapSeats({ benchId: bench.id, seat: 'Left', studentId: 'Empty', studentName: 'Empty' });
                          } else if (leftSeat && leftSeat.studentId !== 'Empty') {
                            setSelectedSeat(leftSeat);
                          } else {
                            setSelectedSeat({ benchId: bench.id, seat: 'Left', studentId: 'Empty', studentName: 'Empty' });
                          }
                        }}
                        className={`p-1.5 rounded border text-center transition-all cursor-pointer select-none relative ${
                          swapSourceSeat?.benchId === bench.id && swapSourceSeat?.seat === 'Left'
                            ? 'bg-amber-100 border-amber-900 ring-2 ring-amber-500 text-amber-950 font-bold scale-105'
                            : leftSeat && leftSeat.studentId !== 'Empty'
                            ? 'bg-white hover:bg-neutral-100 border-neutral-900 text-neutral-950'
                            : 'bg-neutral-100/50 border-dashed border-neutral-300 text-neutral-400 hover:bg-neutral-100'
                        }`}
                      >
                        {leftSeat && leftSeat.studentId !== 'Empty' && leftStudent ? (
                          <div className="space-y-1">
                            {leftStudent.avatar ? (
                              <img
                                src={leftStudent.avatar}
                                alt={leftStudent.name}
                                className="w-5 h-5 rounded-full mx-auto object-cover border border-neutral-300 shadow-xs"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full flex items-center justify-center mx-auto text-[8px] font-bold border bg-neutral-100 text-neutral-700 border-neutral-300">
                                {leftStudent.name.charAt(0)}
                              </div>
                            )}
                            <div className="text-[8.5px] font-bold truncate leading-tight text-neutral-900">
                              {leftStudent.name.split(' ')[0]}
                            </div>

                            {/* Tag indicator dots */}
                            {leftStudent.tags.length > 0 && (
                              <div className="flex justify-center gap-0.5">
                                {leftStudent.tags.slice(0, 3).map((t, i) => (
                                  <span
                                    key={i}
                                    title={t}
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      t.toLowerCase().includes('vision') || t.toLowerCase().includes('front')
                                        ? 'bg-indigo-500'
                                        : t.toLowerCase().includes('talkative')
                                        ? 'bg-amber-500'
                                        : t.toLowerCase().includes('helper') || t.toLowerCase().includes('topper')
                                        ? 'bg-emerald-500'
                                        : 'bg-neutral-400'
                                    }`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="py-2 text-[8px] font-mono italic text-neutral-400">
                            + Empty L
                          </div>
                        )}
                      </div>

                      {/* Right Seat Slot */}
                      <div
                        onClick={() => {
                          if (swapSourceSeat) {
                            if (rightSeat) handleSwapSeats(rightSeat);
                            else handleSwapSeats({ benchId: bench.id, seat: 'Right', studentId: 'Empty', studentName: 'Empty' });
                          } else if (rightSeat && rightSeat.studentId !== 'Empty') {
                            setSelectedSeat(rightSeat);
                          } else {
                            setSelectedSeat({ benchId: bench.id, seat: 'Right', studentId: 'Empty', studentName: 'Empty' });
                          }
                        }}
                        className={`p-1.5 rounded border text-center transition-all cursor-pointer select-none relative ${
                          swapSourceSeat?.benchId === bench.id && swapSourceSeat?.seat === 'Right'
                            ? 'bg-amber-100 border-amber-900 ring-2 ring-amber-500 text-amber-950 font-bold scale-105'
                            : rightSeat && rightSeat.studentId !== 'Empty'
                            ? 'bg-white hover:bg-neutral-100 border-neutral-900 text-neutral-950'
                            : 'bg-neutral-100/50 border-dashed border-neutral-300 text-neutral-400 hover:bg-neutral-100'
                        }`}
                      >
                        {rightSeat && rightSeat.studentId !== 'Empty' && rightStudent ? (
                          <div className="space-y-1">
                            {rightStudent.avatar ? (
                              <img
                                src={rightStudent.avatar}
                                alt={rightStudent.name}
                                className="w-5 h-5 rounded-full mx-auto object-cover border border-neutral-300 shadow-xs"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full flex items-center justify-center mx-auto text-[8px] font-bold border bg-neutral-100 text-neutral-700 border-neutral-300">
                                {rightStudent.name.charAt(0)}
                              </div>
                            )}
                            <div className="text-[8.5px] font-bold truncate leading-tight text-neutral-900">
                              {rightStudent.name.split(' ')[0]}
                            </div>

                            {/* Tag indicator dots */}
                            {rightStudent.tags.length > 0 && (
                              <div className="flex justify-center gap-0.5">
                                {rightStudent.tags.slice(0, 3).map((t, i) => (
                                  <span
                                    key={i}
                                    title={t}
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      t.toLowerCase().includes('vision') || t.toLowerCase().includes('front')
                                        ? 'bg-indigo-500'
                                        : t.toLowerCase().includes('talkative')
                                        ? 'bg-amber-500'
                                        : t.toLowerCase().includes('helper') || t.toLowerCase().includes('topper')
                                        ? 'bg-emerald-500'
                                        : 'bg-neutral-400'
                                    }`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="py-2 text-[8px] font-mono italic text-neutral-400">
                            + Empty R
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reasoning Explanation & Manual Editing Panel */}
          <div className="pt-3.5 border-t border-neutral-200 space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-neutral-700" />
                Seat Inspector & Manual Firebase Assigner
              </span>
              <span className="text-[10px] text-neutral-500 font-normal">
                Click any seat above to view details, swap seats, or manually assign a student
              </span>
            </h3>

            {selectedSeat ? (
              <div className="space-y-3 p-3.5 rounded-lg bg-neutral-50 border border-neutral-900 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                  <span className="text-[10px] font-mono font-bold text-neutral-600 uppercase">
                    {layout.benches?.find(b => b.id === selectedSeat.benchId)?.name || 'Bench'} • {selectedSeat.seat} Seat
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedSeat.studentId !== 'Empty' && (
                      <button
                        onClick={() => handleSwapSeats(selectedSeat)}
                        className="px-2 py-0.5 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-[10px] rounded border border-amber-900 flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowLeftRight className="w-3 h-3" /> Swap Seat
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedSeat(null)}
                      className="text-neutral-400 hover:text-neutral-950 text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Direct Student Selector Dropdown for Manual Placement */}
                <div className="space-y-1.5 bg-white p-2.5 rounded border border-neutral-200">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 block">
                    Manually Change Seated Student (Firebase Saved):
                  </label>
                  <select
                    value={selectedSeat.studentId === 'Empty' ? '' : selectedSeat.studentId}
                    onChange={(e) => {
                      handleDirectAssignStudent(selectedSeat.benchId, selectedSeat.seat, e.target.value);
                      setSelectedSeat(null);
                    }}
                    className="w-full text-xs border border-neutral-900 rounded p-2 bg-neutral-50 font-bold focus:ring-1 focus:ring-neutral-900 cursor-pointer"
                  >
                    <option value="">-- Clear / Leave Empty Seat --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.rollNumber || 'No Roll'})
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  if (selectedSeat.studentId === 'Empty') return null;
                  const selectedStudent = getStudentById(selectedSeat.studentId);
                  if (!selectedStudent) return null;
                  const explain = getExplanationForStudent(selectedStudent.name);

                  return (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        {selectedStudent.avatar ? (
                          <img
                            src={selectedStudent.avatar}
                            alt={selectedStudent.name}
                            className="w-9 h-9 rounded object-cover border border-neutral-300"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded flex items-center justify-center text-xs font-bold border bg-white text-neutral-700 border-neutral-300">
                            {selectedStudent.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-xs text-neutral-900">{selectedStudent.name}</h4>
                          <p className="text-[10px] text-neutral-500 font-mono">
                            Roll No: {selectedStudent.rollNumber || 'N/A'} • Grade: {selectedStudent.grade || 'N/A'}
                          </p>
                        </div>
                      </div>

                      {selectedStudent.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {selectedStudent.tags.map((t) => (
                            <span
                              key={t}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-white text-neutral-700 border border-neutral-200 font-mono"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="text-[11px] text-neutral-700 leading-relaxed pt-2 border-t border-neutral-200 bg-white p-2.5 rounded border border-neutral-200">
                        <span className="text-[9px] font-bold uppercase text-neutral-400 block mb-0.5 font-mono">AI Placement Rationale:</span>
                        {explain ? (
                          <p className="italic">"{explain}"</p>
                        ) : (
                          <p className="text-neutral-400 italic">Positioned to satisfy strategy and physical layout constraints.</p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-1">
                  {reasoning.map((item, idx) => (
                    <div
                      key={idx}
                      className="text-[10px] p-2.5 bg-neutral-50 border border-neutral-200 text-neutral-700 rounded-md hover:border-neutral-400 transition-colors"
                    >
                      <span className="font-bold text-neutral-950 block mb-0.5">{item.studentName}</span>
                      <span className="text-neutral-600 italic">"{item.explanation}"</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
