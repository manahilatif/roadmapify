// src/lib/firestore.js
/**
 * Firestore utilities for user profile, progress, and roadmap management.
 */
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, arrayUnion,
} from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Get or create user profile from Firestore
 * Document structure: { streak, xp, lastActiveDate, roadmaps, createdAt, updatedAt }
 */
export async function getUserProfile(uid) {
  try {
    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)
    
    if (userSnap.exists()) {
      return userSnap.data()
    } else {
      // Create new profile for first-time user
      const newProfile = {
        streak: 0,
        xp: 0,
        lastActiveDate: new Date().toISOString().split('T')[0],
        roadmaps: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      await setDoc(userRef, newProfile)
      return newProfile
    }
  } catch (error) {
    console.error('Error getting user profile:', error)
    throw error
  }
}

/**
 * Update user streak based on last active date
 * Returns { streak, lastActiveDate, changed }
 * - If lastActiveDate === yesterday → increment streak
 * - If lastActiveDate === today → no change
 * - If lastActiveDate < yesterday → reset to 1
 */
export function calculateStreakUpdate(lastActiveDateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  
  const lastActive = lastActiveDateStr ? new Date(lastActiveDateStr) : null
  const lastActiveStr = lastActive ? lastActive.toISOString().split('T')[0] : null
  
  return {
    todayStr,
    yesterdayStr,
    lastActiveStr,
  }
}

/**
 * Update user streak in Firestore after auth resolves
 * Should be called once per session when user logs in
 */
export async function updateUserStreakOnLogin(uid, currentProfile) {
  try {
    const { todayStr, yesterdayStr, lastActiveStr } = calculateStreakUpdate(
      currentProfile.lastActiveDate
    )
    
    let newStreak = currentProfile.streak || 0
    
    if (lastActiveStr === yesterdayStr) {
      // Increment streak (logged in yesterday, logging in today)
      newStreak = (currentProfile.streak || 0) + 1
    } else if (lastActiveStr === todayStr) {
      // Already logged in today, no change
      newStreak = currentProfile.streak || 0
    } else {
      // More than 1 day gap, reset streak
      newStreak = 1
    }
    
    const userRef = doc(db, 'users', uid)
    await updateDoc(userRef, {
      streak: newStreak,
      lastActiveDate: todayStr,
      updatedAt: serverTimestamp(),
    })
    
    return {
      streak: newStreak,
      lastActiveDate: todayStr,
    }
  } catch (error) {
    console.error('Error updating streak:', error)
    throw error
  }
}

/**
 * Update user streak directly (used when completing a node)
 * Increments streak and updates lastActiveDate
 */
export async function updateUserStreak(uid, newStreakValue) {
  try {
    const userRef = doc(db, 'users', uid)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]
    
    await updateDoc(userRef, {
      streak: newStreakValue,
      lastActiveDate: todayStr,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error updating user streak:', error)
    throw error
  }
}

/**
 * Save or update roadmap metadata
 * Creates users/{uid}/roadmaps/{roadmapId} document
 */
export async function saveRoadmap(uid, roadmapId, roadmapData) {
  try {
    const roadmapRef = doc(db, 'users', uid, 'roadmaps', roadmapId)
    
    const roadmapDoc = {
      roadmapId,
      title: roadmapData.title || 'Untitled Roadmap',
      goal: roadmapData.goal || '',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      nodes: roadmapData.nodes || [],
      completedNodes: [],
      xp: 0,
      timeframe: roadmapData.timeframe || '',
    }
    
    await setDoc(roadmapRef, roadmapDoc)
    
    // Also add roadmapId to user's roadmaps array if not already there
    const userRef = doc(db, 'users', uid)
    await updateDoc(userRef, {
      roadmaps: arrayUnion(roadmapId),
      updatedAt: serverTimestamp(),
    })
    
    return roadmapDoc
  } catch (error) {
    console.error('Error saving roadmap:', error)
    throw error
  }
}

/**
 * Update node completion status in roadmap
 */
export async function updateNodeCompletion(uid, roadmapId, nodeId, completed, xpEarned = 0) {
  try {
    const roadmapRef = doc(db, 'users', uid, 'roadmaps', roadmapId)
    
    if (completed) {
      // Mark node as completed
      const roadmapSnap = await getDoc(roadmapRef)
      const roadmapData = roadmapSnap.data()
      const completedNodes = roadmapData?.completedNodes || []
      
      if (!completedNodes.includes(nodeId)) {
        await updateDoc(roadmapRef, {
          completedNodes: arrayUnion(nodeId),
          xp: (roadmapData?.xp || 0) + xpEarned,
          updatedAt: serverTimestamp(),
        })
        
        // Also update user's total XP
        const userRef = doc(db, 'users', uid)
        await updateDoc(userRef, {
          xp: (roadmapData?.xp || 0) + xpEarned,
          updatedAt: serverTimestamp(),
        })
      }
    }
  } catch (error) {
    console.error('Error updating node completion:', error)
    throw error
  }
}

/**
 * Get all user's roadmaps from subcollection
 */
export async function getUserRoadmaps(uid) {
  try {
    const roadmapsRef = collection(db, 'users', uid, 'roadmaps')
    const roadmapsSnap = await getDocs(roadmapsRef)
    
    const roadmaps = []
    roadmapsSnap.forEach(doc => {
      roadmaps.push({ id: doc.id, ...doc.data() })
    })
    
    return roadmaps
  } catch (error) {
    console.error('Error getting user roadmaps:', error)
    return []
  }
}

/**
 * Update roadmap metadata (e.g., timeframe, status)
 */
export async function updateRoadmap(uid, roadmapId, updates) {
  try {
    const roadmapRef = doc(db, 'users', uid, 'roadmaps', roadmapId)
    await updateDoc(roadmapRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error updating roadmap:', error)
    throw error
  }
}
