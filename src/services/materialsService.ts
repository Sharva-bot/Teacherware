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
import { TextbookMaterial } from '../types';

const MATERIALS_COLLECTION = 'materials';

/**
 * Subscribe to the materials collection ordered by creation date
 */
export function subscribeToMaterials(
  onSuccess: (materials: TextbookMaterial[]) => void,
  onError: (error: Error) => void
) {
  const collRef = collection(db, MATERIALS_COLLECTION);
  const q = query(collRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const materials: TextbookMaterial[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        materials.push({
          id: docSnap.id,
          title: data.title || 'Untitled Material',
          images: data.images || [],
          studyGuide: data.studyGuide || null,
          testPaper: data.testPaper || null,
          status: data.status || 'idle',
          error: data.error,
          createdAt: data.createdAt || new Date().toISOString(),
          folder: data.folder || 'Unorganized',
        });
      });
      onSuccess(materials);
    },
    (err) => {
      console.error('Firestore materials subscription error:', err);
      onError(err);
    }
  );
}

/**
 * Create a new textbook material entry
 */
export async function createMaterial(material: Omit<TextbookMaterial, 'id'>): Promise<string> {
  const collRef = collection(db, MATERIALS_COLLECTION);
  const docRef = await addDoc(collRef, {
    title: material.title,
    images: material.images,
    studyGuide: material.studyGuide,
    testPaper: material.testPaper,
    status: material.status,
    error: material.error || '',
    createdAt: material.createdAt || new Date().toISOString(),
    folder: material.folder || 'Unorganized',
  });
  return docRef.id;
}

/**
 * Delete a textbook material entry
 */
export async function deleteMaterial(id: string): Promise<void> {
  const docRef = doc(db, MATERIALS_COLLECTION, id);
  await deleteDoc(docRef);
}

/**
 * Update a textbook material's field values
 */
export async function updateMaterial(id: string, updates: Partial<TextbookMaterial>): Promise<void> {
  const docRef = doc(db, MATERIALS_COLLECTION, id);
  await updateDoc(docRef, updates);
}
