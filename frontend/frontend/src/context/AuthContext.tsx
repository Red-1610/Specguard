"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
  user: string | null;
  token: string | null;
  signin: (session: Session) => void;
  signout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  signin: () => {},
  signout: () => {},
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setToken(session?.access_token ?? null);
      setUser(session?.user.email ?? session?.user.user_metadata?.user_name ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
      setUser(session?.user.email ?? session?.user.user_metadata?.user_name ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signin = (session: Session) => {
    setToken(session.access_token);
    setUser(session.user.email ?? session.user.user_metadata?.user_name ?? null);
    router.push("/");
  };

  const signout = async () => {
    await supabase.auth.signOut();
    router.push("/signin");
  };

  return (
    <AuthContext.Provider value={{ user, token, signin, signout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);