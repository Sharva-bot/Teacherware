import {
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ClassroomLayout } from '../types';

const CLASSROOM_COLLECTION = 'classroom';
const LAYOUT_DOC_ID = 'active_layout';

// Default layout fallback if no layout is configured yet
export const DEFAULT_CLASSROOM_LAYOUT: ClassroomLayout = {
  smartBoardLocation: 'Front',
  doorLocation: 'Back-Left',
  teacherDeskLocation: 'Front-Right',
  windowLocations: ['Left-Wall', 'Right-Wall'],
  customNotes: 'Main Smart Board is centered on the front wall. Please place easily distracted students far away from the Back-Left entrance door.',
  benches: [
    { id: 'bench-1', name: 'Bench 1', x: 20, y: 30 },
    { id: 'bench-2', name: 'Bench 2', x: 20, y: 70 },
    { id: 'bench-3', name: 'Bench 3', x: 50, y: 30 },
    { id: 'bench-4', name: 'Bench 4', x: 50, y: 70 },
    { id: 'bench-5', name: 'Bench 5', x: 80, y: 30 },
    { id: 'bench-6', name: 'Bench 6', x: 80, y: 70 },
  ]
};

/**
 * Fetch the current classroom layout from Firestore
 */
export async function getClassroomLayout(): Promise<ClassroomLayout> {
  try {
    const docRef = doc(db, CLASSROOM_COLLECTION, LAYOUT_DOC_ID);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as ClassroomLayout;
      // Ensure benches list fallback
      if (!data.benches || data.benches.length === 0) {
        data.benches = DEFAULT_CLASSROOM_LAYOUT.benches;
      }
      return data;
    }
    return DEFAULT_CLASSROOM_LAYOUT;
  } catch (err) {
    console.error('Error fetching classroom layout:', err);
    return DEFAULT_CLASSROOM_LAYOUT;
  }
}

/**
 * Save the classroom layout configuration to Firestore
 */
export async function saveClassroomLayout(layout: ClassroomLayout): Promise<void> {
  const docRef = doc(db, CLASSROOM_COLLECTION, LAYOUT_DOC_ID);
  await setDoc(docRef, {
    smartBoardLocation: layout.smartBoardLocation,
    doorLocation: layout.doorLocation,
    teacherDeskLocation: layout.teacherDeskLocation,
    windowLocations: layout.windowLocations || [],
    customNotes: layout.customNotes || '',
    benches: layout.benches || [],
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Subscribe to realtime updates for classroom layout from Firestore
 */
export function subscribeToClassroomLayout(
  onSuccess: (layout: ClassroomLayout) => void,
  onError: (error: Error) => void
) {
  const docRef = doc(db, CLASSROOM_COLLECTION, LAYOUT_DOC_ID);

  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as ClassroomLayout;
        if (!data.benches || data.benches.length === 0) {
          data.benches = DEFAULT_CLASSROOM_LAYOUT.benches;
        }
        onSuccess(data);
      } else {
        onSuccess(DEFAULT_CLASSROOM_LAYOUT);
      }
    },
    (err) => {
      console.error('Firestore classroom layout listener error:', err);
      onError(err);
    }
  );
}
