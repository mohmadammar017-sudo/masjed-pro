
import { MosqueProfile, MosqueData } from '../types';
import { generateMosqueId, hashPin } from '../utils';
import { db as firestoreDb, isConfigured } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { imageService } from './ImageService';
import { MOSQUE_INFO, OCCASION_DATA, INITIAL_PRAYER_SCHEDULE, DEFAULT_ADHAN_SETTINGS, DEFAULT_PRAYER_SETTINGS } from '../constants';

const LOCAL_STORAGE_KEY = 'mosque_profile_v1';

export const MosqueManager = {
  
  async getSession(): Promise<MosqueProfile | null> {
    // 1. Try Local Storage first
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local) {
        return JSON.parse(local);
    }
    return null;
  },

  async login(id: string, pin: string): Promise<MosqueProfile | null> {
    const hashedPin = await hashPin(pin);
    
    // 1. Check Local
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local) {
        const profile = JSON.parse(local) as MosqueProfile;
        if (profile.id === id && profile.pin === hashedPin) {
            return profile;
        }
    }

    // 2. Check Cloud (Firestore)
    if (isConfigured && firestoreDb) {
        try {
            const docRef = doc(firestoreDb, "mosques", id);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data() as MosqueProfile;
                if (data.pin === hashedPin) {
                    this.saveToLocal(data);
                    return data;
                }
            }
        } catch (e) {
            console.error("Login Error", e);
        }
    }
    
    return null;
  },

  async createProfile(name: string, pin: string): Promise<MosqueProfile> {
      const id = generateMosqueId();
      const hashedPin = await hashPin(pin);
      
      const newProfile: MosqueProfile = {
          id,
          pin: hashedPin,
          lastUpdated: Date.now(),
          data: {
              mosqueInfo: { ...MOSQUE_INFO, name },
              occasion: OCCASION_DATA,
              schedule: INITIAL_PRAYER_SCHEDULE as any,
              monthlySchedule: null,
              adhanSettings: DEFAULT_ADHAN_SETTINGS,
              prayerSettings: DEFAULT_PRAYER_SETTINGS,
              theme: {
                  homeBackgroundImage: null,
                  homeBackgroundColor: '#020617',
                  homeOverlayColor: '#000000',
                  homeOverlayOpacity: 0.4
              },
              hijriOffset: 0
          }
      };

      await this.saveData(id, newProfile.data, true);
      return newProfile;
  },

  async saveData(id: string, partialData: any, isFullProfile = false) {
    // 1. Update Local
    const current = await this.getSession();
    if (!current && !isFullProfile) return;

    const updatedProfile = isFullProfile ? (partialData as MosqueProfile) : {
        ...current!,
        data: { ...current!.data, ...partialData },
        lastUpdated: Date.now()
    };
    
    this.saveToLocal(updatedProfile);

    // 2. Sync to Cloud
    if (isConfigured && firestoreDb) {
        try {
            await setDoc(doc(firestoreDb, "mosques", id), updatedProfile, { merge: true });
        } catch (e) {
            console.warn("Cloud sync failed (Offline?)");
        }
    }
  },

  saveToLocal(profile: MosqueProfile) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
  },

  async uploadImage(file: File, folder: string): Promise<string> {
      const path = `images/${folder}/${Date.now()}_${file.name}`;
      return await imageService.uploadToCloud(file, path);
  },

  logout() {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      // Optional: Clear indexedDB images if security is strict
  }
};
