"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert, ArrowRight, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
export default function SignUpPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signin, token, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && token) {
      router.replace("/");
    }
  }, [authLoading, router, token]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: username,
        password,
      });
      if (error) throw error;
      if (!data.session) {
        router.push(`/verification?email=${encodeURIComponent(username)}`);
        return;
      }
      signin(data.session);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignup = async (provider: "google" | "github") => {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/signup` },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(225,29,72,0.15),transparent)]">
      <div className="w-full max-w-md bg-slate-900/70 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Create SpecGuard Account</h1>
            <p className="text-xs text-slate-400">Deterministic blast-radius code review</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">Email</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-rose-500 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-rose-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 py-2.5 rounded-xl text-sm font-medium transition shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? "Creating account..." : (
              <>
                <UserPlus className="w-4 h-4" /> Sign Up
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => handleOAuthSignup("google")} className="w-full border border-slate-700 rounded-xl py-2.5 text-sm hover:bg-slate-800 transition">
              Continue with Google
            </button>
            <button type="button" onClick={() => handleOAuthSignup("github")} className="w-full border border-slate-700 rounded-xl py-2.5 text-sm hover:bg-slate-800 transition">
              Continue with GitHub
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          Already have an account?{" "}
          <Link href="/signin" className="text-rose-400 hover:underline inline-flex items-center gap-1">
            Sign In <ArrowRight className="w-3 h-3" />
          </Link>
        </p>
      </div>
    </div>
  );
}