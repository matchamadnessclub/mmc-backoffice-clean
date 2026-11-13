'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';

// allowedRoles: เช่น ['owner'] หรือ ['staff', 'owner']
export function useAuth(allowedRoles) {
  const router = useRouter();
  const [state, setState] = useState({ loading: true, user: null, profile: null });

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, display_name')
        .eq('id', session.user.id)
        .single();
      if (!active) return;
      if (!profile) {
        await supabase.auth.signOut();
        router.replace('/');
        return;
      }
      if (allowedRoles && !allowedRoles.includes(profile.role)) {
        router.replace(profile.role === 'owner' ? '/owner' : '/staff');
        return;
      }
      setState({ loading: false, user: session.user, profile });
    }
    load();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/');
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  return { ...state, signOut };
}
