import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student } from '../types';

const STUDENTS_COLLECTION = 'students';

/**
 * Subscribe to realtime updates for students from Firestore.
 * No automatic placeholder seeding — starts completely blank.
 */
export function subscribeToStudents(
  onSuccess: (students: Student[]) => void,
  onError: (error: Error) => void
) {
  const studentsRef = collection(db, STUDENTS_COLLECTION);
  const q = query(studentsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const studentsList: Student[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        studentsList.push({
          id: docSnap.id,
          name: data.name || '',
          rollNumber: data.rollNumber || '',
          grade: data.grade || 'Grade 10-A',
          tags: Array.isArray(data.tags) ? data.tags : [],
          notes: data.notes || undefined,
          joinedDate: data.createdAt || data.joinedDate || new Date().toISOString().split('T')[0],
          gender: data.gender || 'Male',
          avatar: data.avatar || undefined,
        });
      });

      onSuccess(studentsList);
    },
    (err) => {
      console.error('Firestore students listener error:', err);
      onError(err);
    }
  );
}

/**
 * Add a new student document to Firestore
 */
export async function createStudent(studentData: Omit<Student, 'id'>): Promise<string> {
  const studentsRef = collection(db, STUDENTS_COLLECTION);
  const newDocRef = doc(studentsRef);
  
  await setDoc(newDocRef, {
    name: studentData.name,
    rollNumber: studentData.rollNumber,
    grade: studentData.grade,
    tags: studentData.tags,
    notes: studentData.notes || '',
    gender: studentData.gender,
    avatar: studentData.avatar || '',
    createdAt: studentData.joinedDate || new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString(),
  });

  return newDocRef.id;
}

/**
 * Remove a student document from Firestore
 */
export async function deleteStudent(studentId: string): Promise<void> {
  const docRef = doc(db, STUDENTS_COLLECTION, studentId);
  await deleteDoc(docRef);
}

/**
 * Update tags for a given student
 */
export async function updateStudentTags(studentId: string, tags: string[]): Promise<void> {
  const docRef = doc(db, STUDENTS_COLLECTION, studentId);
  await updateDoc(docRef, {
    tags,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Clear all students in Firestore roster
 */
export async function clearAllStudents(): Promise<void> {
  const snapshot = await getDocs(collection(db, STUDENTS_COLLECTION));
  if (snapshot.empty) return;
  
  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => {
    batch.delete(d.ref);
  });
  await batch.commit();
}
