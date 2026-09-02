import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ExamRecord } from '../types';

const EXAMS_COLLECTION = 'examRecords';

/**
 * Subscribe to the examRecords collection ordered by creation date
 */
export function subscribeToExams(
  onSuccess: (exams: ExamRecord[]) => void,
  onError: (error: Error) => void
) {
  const collRef = collection(db, EXAMS_COLLECTION);
  const q = query(collRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const exams: ExamRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        exams.push({
          id: docSnap.id,
          examTitle: data.examTitle || 'Untitled Exam',
          subject: data.subject || 'General',
          maxScore: data.maxScore || 100,
          createdAt: data.createdAt || new Date().toISOString(),
          answerKey: data.answerKey || '',
          gradedPapers: Array.isArray(data.gradedPapers) ? data.gradedPapers : [],
        });
      });
      onSuccess(exams);
    },
    (err) => {
      console.error('Firestore examRecords subscription error:', err);
      onError(err);
    }
  );
}

/**
 * Create a new Exam Record entry in Firestore
 */
export async function createExamRecord(exam: Omit<ExamRecord, 'id'>): Promise<string> {
  const collRef = collection(db, EXAMS_COLLECTION);
  const docRef = await addDoc(collRef, {
    examTitle: exam.examTitle,
    subject: exam.subject || 'General',
    maxScore: exam.maxScore,
    createdAt: exam.createdAt || new Date().toISOString(),
    answerKey: exam.answerKey || '',
    gradedPapers: exam.gradedPapers || [],
  });
  return docRef.id;
}

/**
 * Delete an Exam Record entry from Firestore
 */
export async function deleteExamRecord(id: string): Promise<void> {
  const docRef = doc(db, EXAMS_COLLECTION, id);
  await deleteDoc(docRef);
}

/**
 * Update an Exam Record's fields in Firestore
 */
export async function updateExamRecord(id: string, updates: Partial<ExamRecord>): Promise<void> {
  const docRef = doc(db, EXAMS_COLLECTION, id);
  await updateDoc(docRef, updates);
}
