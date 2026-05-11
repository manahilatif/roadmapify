// src/services/roadmapsFirestore.js
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'

export function roadmapsCollectionRef(uid) {
  return collection(db, 'users', uid, 'roadmaps')
}

export async function createUserRoadmap(uid, { topic, roadmapData }) {
  const ref = await addDoc(roadmapsCollectionRef(uid), {
    topic: topic || roadmapData?.title || 'My roadmap',
    roadmapData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateUserRoadmap(uid, roadmapId, { topic, roadmapData }) {
  const payload = {
    roadmapData,
    updatedAt: serverTimestamp(),
  }
  if (topic != null) payload.topic = topic
  await updateDoc(doc(db, 'users', uid, 'roadmaps', roadmapId), payload)
}

export async function listUserRoadmaps(uid) {
  const q = query(roadmapsCollectionRef(uid), orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getUserRoadmap(uid, roadmapId) {
  const snap = await getDoc(doc(db, 'users', uid, 'roadmaps', roadmapId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function deleteUserRoadmap(uid, roadmapId) {
  await deleteDoc(doc(db, 'users', uid, 'roadmaps', roadmapId))
}
