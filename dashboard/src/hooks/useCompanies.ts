import { useEffect, useState } from 'react';
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, getDocs,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { type Company, type Material } from '../lib/materials';

/** Companies owned by the signed-in user, with CRUD; plus shared-with-me. */
export function useCompanies() {
  const [uid, setUid] = useState<string | null>(
    auth.currentUser?.uid ?? null
  );
  const [companies, setCompanies] = useState<Company[]>([]);
  const [shared, setShared] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(
    () => onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null)),
    []
  );

  useEffect(() => {
    if (!uid) {
      setCompanies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'companies'),
      where('ownerUid', '==', uid)
    );
    return onSnapshot(
      q,
      (snap) => {
        setCompanies(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Company, 'id'>),
          }))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [uid]);

  // Companies shared with me (my uid is in viewerUids) — read-only (SM-41).
  useEffect(() => {
    if (!uid) {
      setShared([]);
      return;
    }
    const q = query(
      collection(db, 'companies'),
      where('viewerUids', 'array-contains', uid)
    );
    return onSnapshot(
      q,
      (snap) => setShared(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Company, 'id'>) }))
      ),
      () => setShared([])
    );
  }, [uid]);

  const addCompany = async (name: string, notes = '') => {
    if (!uid) return;
    await addDoc(collection(db, 'companies'), {
      ownerUid: uid, name, notes, createdAt: Date.now(), updatedAt: Date.now(),
    });
  };
  const updateCompany = async (id: string, patch: Partial<Company>) => {
    await updateDoc(doc(db, 'companies', id), {
      ...patch, updatedAt: Date.now(),
    });
  };
  const deleteCompany = async (id: string) => {
    // Cascade: remove materials first (Firestore has no cascade delete).
    const mats = await getDocs(collection(db, 'companies', id, 'materials'));
    await Promise.all(mats.docs.map((m) => deleteDoc(m.ref)));
    await deleteDoc(doc(db, 'companies', id));
  };

  return {
    companies, shared, loading, signedIn: !!uid, uid,
    addCompany, updateCompany, deleteCompany,
  };
}

/** Materials of one company, with save (add/update) + delete. */
export function useMaterials(companyId: string | null) {
  const [materials, setMaterials] = useState<Material[]>([]);

  useEffect(() => {
    if (!companyId) {
      setMaterials([]);
      return;
    }
    const col = collection(db, 'companies', companyId, 'materials');
    return onSnapshot(col, (snap) => {
      setMaterials(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Material, 'id'>),
        }))
      );
    });
  }, [companyId]);

  const saveMaterial = async (m: Material) => {
    if (!companyId) return;
    const col = collection(db, 'companies', companyId, 'materials');
    const data = {
      name: m.name, unit: m.unit, composition: m.composition,
      updatedAt: Date.now(),
    };
    if (m.id) await updateDoc(doc(col, m.id), data);
    else await addDoc(col, data);
  };
  const deleteMaterial = async (id: string) => {
    if (!companyId) return;
    await deleteDoc(doc(db, 'companies', companyId, 'materials', id));
  };

  return { materials, saveMaterial, deleteMaterial };
}
