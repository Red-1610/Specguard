"use client";

import React, {
  useRef,
  useState,
  useEffect,
  ChangeEvent,
  KeyboardEvent,
  ClipboardEvent,
  Suspense,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert, Mail, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

function VerificationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userEmail, setUserEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const [timeLeft, setTimeLeft] = useState<number>(59);
  const [canResend, setCanResend] = useState<boolean>(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setUserEmail(emailParam);
    }
  }, [searchParams]);

  // Countdown timer logic
  useEffect(() => {
    if (timeLeft === 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Resend OTP code
  const handleResendClick = async () => {
    if (!canResend || resending) return;
    if (!userEmail) {
      setError("Email address is missing. Please return to sign up.");
      return;
    }

    setResending(true);
    setError("");
    setMessage("");

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: userEmail,
      });

      if (error) throw error;

      setOtp(new Array(6).fill(""));
      setTimeLeft(59);
      setCanResend(false);
      setMessage("A fresh 6-digit verification code has been sent.");
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || "Failed to resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const verifyCode = async (otpCode: string) => {
    if (verifying) return;
    if (!userEmail) {
      setError("Email address is missing. Please return to sign up.");
      return;
    }

    setVerifying(true);
    setError("");

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: userEmail,
        token: otpCode,
        type: "email",
      });

      if (error) throw error;
      router.replace("/");
    } catch (err: any) {
      setError(err.message || "Verification code is invalid or expired.");
      setVerifying(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    if (!val && e.target.value) return;

    const newOtp = [...otp];
    newOtp[index] = val ? val.slice(-1) : "";
    setOtp(newOtp);

    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const finalCode = newOtp.join("");
    if (finalCode.length === 6 && !newOtp.includes("")) {
      void verifyCode(finalCode);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim().replace(/[^0-9]/g, "");
    if (pastedData.length === 6) {
      const digits = pastedData.split("");
      setOtp(digits);
      inputRefs.current[5]?.focus();
      void verifyCode(pastedData);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Check your email</h1>
          <p className="text-xs text-slate-400">Account verification code</p>
        </div>
      </div>

      <p className="mb-6 text-xs leading-relaxed text-slate-400">
        We sent a 6-digit confirmation code to{" "}
        <span className="font-semibold text-slate-200">
          {userEmail || "your email address"}
        </span>
        . Enter the code below to activate your SpecGuard account.
      </p>

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      {/* OTP Inputs */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {otp.map((digit, index) => (
          <React.Fragment key={index}>
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(e, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onPaste={handlePaste}
              disabled={verifying}
              className={`h-13 w-11 rounded-xl border bg-slate-950 text-center font-mono text-lg font-semibold text-white transition focus:outline-none focus:ring-2 ${
                digit
                  ? "border-rose-500/60 ring-1 ring-rose-500/30"
                  : "border-slate-800 hover:border-slate-700"
              } focus:border-rose-400 focus:ring-rose-500/40`}
            />
            {index === 2 && (
              <span className="px-0.5 font-bold text-slate-600">—</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {verifying && (
        <div className="mb-4 flex items-center justify-center gap-2 text-xs text-rose-300">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>Verifying confirmation code...</span>
        </div>
      )}

      {/* Timer and Resend */}
      <div className="flex flex-col items-center gap-3 text-xs text-slate-400">
        {canResend ? (
          <button
            type="button"
            onClick={handleResendClick}
            disabled={resending}
            className="flex items-center gap-1.5 font-medium text-rose-400 transition hover:text-rose-300 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${resending ? "animate-spin" : ""}`} />
            <span>{resending ? "Sending code..." : "Resend 6-digit code"}</span>
          </button>
        ) : (
          <p className="font-mono text-slate-500">
            Resend available in{" "}
            <span className="font-semibold text-slate-300">
              0:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
            </span>
          </p>
        )}

        <div className="mt-4 border-t border-slate-800/80 pt-4 text-center">
          <Link
            href="/signin"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerificationPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#07090e] p-6 selection:bg-rose-500/30 selection:text-rose-200">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(225,29,72,0.15),transparent)]" />
      <Suspense
        fallback={
          <div className="font-mono text-xs text-slate-500">
            Loading verification...
          </div>
        }
      >
        <VerificationContent />
      </Suspense>
    </div>
  );
}