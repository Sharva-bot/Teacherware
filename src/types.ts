export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  grade: string;
  tags: string[];
  notes?: string;
  joinedDate?: string;
  gender: 'Male' | 'Female';
  avatar?: string; // base64 string
}

export interface TagStyle {
  bg: string;
  text: string;
  border: string;
  dot: string;
}

export interface Bench {
  id: string;
  name: string;
  x: number; // 0 to 100 representing position as a percentage inside the canvas
  y: number; // 0 to 100 representing position as a percentage inside the canvas
}

export type SeatingStrategyMode = 
  | 'behavioral'       // Balance focus & separate talkative students
  | 'peer_tutoring'    // Pair high-performing helpers with struggling students
  | 'exam_anti_cheat'  // Maximum space & isolation for quizzes/tests
  | 'gender_balanced'  // Equal male/female distribution
  | 'social_mixing';   // Mix up social groups & foster new friendships

export interface SeatingRule {
  id: string;
  type: 'separate' | 'pair' | 'lock';
  student1Id: string;
  student2Id?: string; // For 'separate' or 'pair'
  benchId?: string;    // For 'lock'
  seat?: 'Left' | 'Right'; // For 'lock'
}

export interface BenchInsight {
  benchId: string;
  compatibilityLabel: string;
  type: 'optimal' | 'warning' | 'neutral';
  description: string;
}

export interface SeatingHarmonyAnalysis {
  overallScore: number; // 0-100
  summary: string;
  metrics?: {
    visionNeedsMet?: number;
    talkativeSeparated?: number;
    conflictsAvoided?: number;
    peerPairsCreated?: number;
  };
  benchInsights?: {
    benchId: string;
    compatibilityLabel: string;
    type: 'optimal' | 'warning' | 'neutral';
    description: string;
  }[];
}

export interface ClassroomLayout {
  id?: string;
  smartBoardLocation: 'Front' | 'Back' | 'Left' | 'Right';
  doorLocation: 'Front-Left' | 'Front-Right' | 'Back-Left' | 'Back-Right' | 'Left-Wall' | 'Right-Wall';
  teacherDeskLocation: 'Front-Left' | 'Front-Right' | 'Front-Center' | 'Back-Left' | 'Back-Right' | 'None';
  windowLocations: ('Left-Wall' | 'Right-Wall' | 'Back-Wall' | 'Front-Wall')[];
  customNotes?: string;
  benches?: Bench[];
}

export interface TextbookMaterial {
  id: string;
  title: string;
  images: string[]; // compressed base64 data URIs
  studyGuide: string | null;
  testPaper: string | null;
  status: 'idle' | 'generating' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  folder?: string; // name of folder/category (e.g. "Biology", "General", "Math")
}

export interface QuestionCorrection {
  questionNumber: string;
  studentAnswer: string;
  correctAnswer?: string;
  maxMarks: number;
  marksAwarded: number;
  isCorrect: boolean;
  feedback?: string;
}

export interface GradedPaperResult {
  id: string;
  imageUri?: string; // base64 or photo URL
  detectedName: string; // Name OCR'd from test paper
  matchedStudentId: string | null; // Student ID matched from roster
  matchedStudentName: string; // Matched Student Name or Detected Name
  rollNumber?: string;
  status: 'graded' | 'unmatched' | 'failed' | 'uncorrected_guardrail_blocked';
  score: number;
  maxScore: number;
  percentage: number;
  grade: string; // 'A+', 'A', 'B', 'C', 'D', 'F'
  overallFeedback: string;
  questionBreakdown: QuestionCorrection[];
  gradedAt: string;
  isTeacherCorrected?: boolean;
  teacherCorrectionDetected?: boolean;
  guardrailMessage?: string;
  teacherGradingAudit?: {
    humanTeacherScore?: number | null;
    aiVerifiedScore?: number;
    hasTeacherDiscrepancy?: boolean;
    teacherMistakesFound?: string[];
    auditSummary?: string;
  };
}

export interface ExamRecord {
  id: string;
  examTitle: string;
  subject?: string;
  maxScore: number;
  createdAt: string;
  answerKey?: string;
  gradedPapers: GradedPaperResult[];
}

export interface SeatAssignment {
  benchId: string;
  seat: 'Left' | 'Right';
  studentId: string;
  studentName: string;
}

export interface SavedSeatingArrangement {
  assignments: SeatAssignment[];
  customRules: SeatingRule[];
  strategy: SeatingStrategyMode;
  harmonyAnalysis: SeatingHarmonyAnalysis | null;
  reasoning: { studentName: string; explanation: string }[];
  updatedAt: string;
}

export interface CheatingAlert {
  id: string;
  examId: string;
  examTitle: string;
  student1Id: string;
  student1Name: string;
  student2Id: string;
  student2Name: string;
  benchId: string;
  benchName: string;
  similarityPercentage: number;
  suspicionLevel: 'high' | 'medium' | 'low';
  identicalMistakes: string[];
  summary: string;
  status: 'active_warning' | 'separated' | 'dismissed';
  detectedAt: string;
}

