import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  SavedSeatingArrangement,
  CheatingAlert,
  SeatingRule,
  SeatAssignment,
  SeatingStrategyMode,
  SeatingHarmonyAnalysis
} from '../types';

const SEATING_COLLECTION = 'seating';
const ACTIVE_ARRANGEMENT_DOC = 'active_arrangement';
const CHEATING_ALERTS_COLLECTION = 'cheatingAlerts';

/**
 * Fetch the active seating arrangement from Firestore
 */
export async function getActiveSeatingArrangement(): Promise<SavedSeatingArrangement | null> {
  try {
    const docRef = doc(db, SEATING_COLLECTION, ACTIVE_ARRANGEMENT_DOC);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as SavedSeatingArrangement;
    }
    return null;
  } catch (err) {
    console.error('Error fetching active seating arrangement from Firestore:', err);
    return null;
  }
}

/**
 * Save / Update active seating arrangement in Firestore
 */
export async function saveActiveSeatingArrangement(
  arrangement: Partial<SavedSeatingArrangement>
): Promise<void> {
  const docRef = doc(db, SEATING_COLLECTION, ACTIVE_ARRANGEMENT_DOC);
  
  // Clean payload for Firestore serialization
  const dataToSave: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };

  if (arrangement.assignments !== undefined) dataToSave.assignments = arrangement.assignments;
  if (arrangement.customRules !== undefined) dataToSave.customRules = arrangement.customRules;
  if (arrangement.strategy !== undefined) dataToSave.strategy = arrangement.strategy;
  if (arrangement.harmonyAnalysis !== undefined) dataToSave.harmonyAnalysis = arrangement.harmonyAnalysis;
  if (arrangement.reasoning !== undefined) dataToSave.reasoning = arrangement.reasoning;

  await setDoc(docRef, dataToSave, { merge: true });
}

/**
 * Subscribe to real-time updates for active seating arrangement
 */
export function subscribeToSeatingArrangement(
  onSuccess: (arrangement: SavedSeatingArrangement | null) => void,
  onError: (error: Error) => void
) {
  const docRef = doc(db, SEATING_COLLECTION, ACTIVE_ARRANGEMENT_DOC);

  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onSuccess(docSnap.data() as SavedSeatingArrangement);
      } else {
        onSuccess(null);
      }
    },
    (err) => {
      console.error('Firestore seating arrangement subscription error:', err);
      onError(err);
    }
  );
}

/**
 * Save new cheating detection alert(s) to Firestore
 */
export async function saveCheatingAlert(alertData: Omit<CheatingAlert, 'id'>): Promise<string> {
  const collRef = collection(db, CHEATING_ALERTS_COLLECTION);
  const docRef = await addDoc(collRef, {
    ...alertData,
    detectedAt: alertData.detectedAt || new Date().toISOString(),
  });
  return docRef.id;
}

/**
 * Subscribe to live cheating alerts from Firestore
 */
export function subscribeToCheatingAlerts(
  onSuccess: (alerts: CheatingAlert[]) => void,
  onError: (error: Error) => void
) {
  const collRef = collection(db, CHEATING_ALERTS_COLLECTION);
  const q = query(collRef, orderBy('detectedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const alerts: CheatingAlert[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        alerts.push({
          id: docSnap.id,
          examId: data.examId || '',
          examTitle: data.examTitle || 'Exam',
          student1Id: data.student1Id || '',
          student1Name: data.student1Name || 'Student 1',
          student2Id: data.student2Id || '',
          student2Name: data.student2Name || 'Student 2',
          benchId: data.benchId || '',
          benchName: data.benchName || 'Bench',
          similarityPercentage: data.similarityPercentage || 0,
          suspicionLevel: data.suspicionLevel || 'medium',
          identicalMistakes: Array.isArray(data.identicalMistakes) ? data.identicalMistakes : [],
          summary: data.summary || '',
          status: data.status || 'active_warning',
          detectedAt: data.detectedAt || new Date().toISOString(),
        });
      });
      onSuccess(alerts);
    },
    (err) => {
      console.error('Firestore cheatingAlerts subscription error:', err);
      onError(err);
    }
  );
}

/**
 * Update cheating alert status (e.g. 'separated' or 'dismissed')
 */
export async function updateCheatingAlertStatus(
  alertId: string,
  status: 'active_warning' | 'separated' | 'dismissed'
): Promise<void> {
  const docRef = doc(db, CHEATING_ALERTS_COLLECTION, alertId);
  await updateDoc(docRef, { status });
}

/**
 * Delete a cheating alert entry from Firestore
 */
export async function deleteCheatingAlert(alertId: string): Promise<void> {
  const docRef = doc(db, CHEATING_ALERTS_COLLECTION, alertId);
  await deleteDoc(docRef);
}
