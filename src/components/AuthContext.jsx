/* eslint-disable react-refresh/only-export-components */
import  { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';

const AuthContext = createContext(null);

 export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  },[]);
  

  const login =(email,password) =>signInWithEmailAndPassword(auth,email,password);
  const signup =(email,password) =>createUserWithEmailAndPassword(auth,email,password);
  const logout =() =>signOut(auth);
  
  const updateUserProfile = (displayName, photoURL) => {
    if (!auth.currentUser) return Promise.reject(new Error("No user is logged in"));
    return updateProfile(auth.currentUser, { displayName, photoURL }).then(() => {
      setUser({ ...auth.currentUser });
    });
  };

   return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateUserProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
export const useAuth = () =>  useContext(AuthContext);
