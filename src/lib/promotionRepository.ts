import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from './firebase'
import type { PromotionProfileId, SavedPromotionScenario } from './promotionEngine'

const mapScenario = (id: string, data: Record<string, unknown>): SavedPromotionScenario => ({
  id,
  name: String(data.name || ''),
  currentSalary: Number(data.currentSalary || 0),
  newSalary: Number(data.newSalary || 0),
  profileId: data.profileId as PromotionProfileId,
  increase: Number(data.increase || 0),
  increaseRate: Number(data.increaseRate || 0),
  createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
})

export const getPromotionUser = async () => auth.currentUser

export const loadPromotionScenarios = async (userId: string): Promise<SavedPromotionScenario[]> => {
  const snapshot = await getDocs(query(
    collection(db, 'users', userId, 'promotionScenarios'),
    orderBy('createdAt', 'desc'),
  ))
  return snapshot.docs.map((item) => mapScenario(item.id, item.data()))
}

export const savePromotionScenario = async (
  userId: string,
  input: Omit<SavedPromotionScenario, 'id' | 'createdAt'>,
): Promise<SavedPromotionScenario> => {
  const reference = await addDoc(collection(db, 'users', userId, 'promotionScenarios'), {
    ...input,
    createdAt: serverTimestamp(),
  })
  return {
    ...input,
    id: reference.id,
    createdAt: new Date().toISOString(),
  }
}

export const deletePromotionScenario = async (userId: string, scenarioId: string) => {
  await deleteDoc(doc(db, 'users', userId, 'promotionScenarios', scenarioId))
}

export { isFirebaseConfigured }
