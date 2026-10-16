"use client";

import React, { useRef, useState, useEffect, ChangeEvent, KeyboardEvent, ClipboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase";

export default function VerificationPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("your email");
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(''));
  const [timeLeft, setTimeLeft] = useState<number>(59); // 60-second countdown
  const [canResend, setCanResend] = useState<boolean>(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [verifying, setVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const email = new URLSearchParams(window.location.search).get("email");
    if (email) setUserEmail(email);
  }, []);

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

  // Handle Resend Click
  const handleResendClick = () => {
    if (!canResend) return;
    setOtp(new Array(6).fill('')); // Clear boxes
    setTimeLeft(59); // Reset clock
    setCanResend(false);
    inputRefs.current[0]?.focus(); // Refocus first box
    if (userEmail === "your email") {
      setError("Your email address is missing. Please return to sign up.");
      return;
    }

    supabase.auth.resend({ type: "signup", email: userEmail }).then(({ error }) => {
      if (error) {
        setError(error.message);
        return;
      }
      setMessage("A new verification code was sent.");
    });
  };

  const verifyCode = async (otpCode: string) => {
    if (verifying || userEmail === "your email") return;
    setVerifying(true);
    setError("");

    const { error } = await supabase.auth.verifyOtp({
      email: userEmail,
      token: otpCode,
      type: "email",
    });

    if (error) {
      setError(error.message);
      setVerifying(false);
      return;
    }

    router.replace("/");
  };

  // Typing logic
  const handleChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value;
    if (isNaN(Number(val))) return; 

    const newOtp = [...otp];
    newOtp[index] = val.substring(val.length - 1);
    setOtp(newOtp);

    // Focus next box
    if (val && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit on 6th digit complete
    const finalCode = newOtp.join('');
    if (finalCode.length === 6 && index === 5 && val) {
      void verifyCode(finalCode);
    }
  };

  // Backspacing logic
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0 && inputRefs.current[index - 1]) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  // Paste logic
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setOtp(digits);
      void verifyCode(pastedData);
    }
  };

  return (
    <div style={{
      maxWidth: '420px',
      margin: '40px auto',
      padding: '32px',
      borderRadius: '16px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      backgroundColor: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      textAlign: 'center'
    }}>
      {/* Icon Anchor */}
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>✉️</div>
      
      <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: '0 0 8px 0' }}>
        Check your email
      </h2>
      
      <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: '1.5', margin: '0 0 32px 0' }}>
        We sent a 6-digit confirmation code to <br />
        <strong style={{ color: '#374151' }}>{userEmail}</strong>. <br />
        Enter the code below to activate your account.
      </p>

      {error && <p style={{ color: '#DC2626', fontSize: '14px', marginBottom: '16px' }}>{error}</p>}
      {message && <p style={{ color: '#059669', fontSize: '14px', marginBottom: '16px' }}>{message}</p>}

      {/* OTP Grid Wrapper */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
        {otp.map((digit, index) => (
          <React.Fragment key={index}>
            <input
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(e, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onPaste={handlePaste}
              style={{
                width: '46px',
                height: '54px',
                fontSize: '24px',
                fontWeight: '600',
                textAlign: 'center',
                borderRadius: '10px',
                border: `2px solid ${digit ? '#4F46E5' : '#E5E7EB'}`,
                outline: 'none',
                backgroundColor: '#F9FAFB',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => e.target.style.borderColor = '#4F46E5'}
              onBlur={(e) => e.target.style.borderColor = digit ? '#4F46E5' : '#E5E7EB'}
            />
            {/* Visual Break: Adds a dash (-) right after the 3rd box for readability */}
            {index === 2 && <span style={{ color: '#9CA3AF', fontWeight: 'bold', margin: '0 4px' }}>—</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Timer & Resend Section */}
      <div style={{ fontSize: '14px', color: '#6B7280' }}>
        {canResend ? (
          <p style={{ margin: 0 }}>
            Didn't receive the code?{' '}
            <button 
              onClick={handleResendClick}
              style={{
                background: 'none',
                border: 'none',
                color: '#4F46E5',
                fontWeight: '600',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline'
              }}
            >
              Resend Code
            </button>
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            Resend code in <span style={{ fontWeight: '600', color: '#111827' }}>0:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}</span>
          </p>
        )}
      </div>
      {verifying && <p style={{ color: '#6B7280', fontSize: '13px', marginTop: '12px' }}>Verifying code...</p>}
    </div>
  );
}