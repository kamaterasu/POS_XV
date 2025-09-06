'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PiEyeClosedBold, PiEyeBold } from 'react-icons/pi';
import { supabase } from '@/lib/supabaseClient';

export default function Page() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);

    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw new Error(error.message);

      router.replace('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      let msg = 'Алдаа гарлаа.';
      if (typeof err === 'string') msg = err;
      else if (err && typeof err === 'object' && 'message' in err) {
        msg = (err as { message?: string }).message ?? msg;
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-[#F7F7F5] min-h-dvh flex items-center justify-center px-4">
      <div className="w-[360px] bg-white rounded-xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-center text-black">Нэвтрэх</h1>

        <form onSubmit={handleLogin} className="mt-5 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-black">
              И-мэйл
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="username"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#D9D9D9] w-full h-[40px] rounded-xl px-4 text-[13px] outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-black">
              Нууц үг
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPw ? 'text' : 'password'}
                placeholder="Нууц үг"
                autoComplete="current-password"
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#D9D9D9] w-full h-[40px] rounded-xl pr-10 pl-4 text-[13px] outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
              />
              <button
                type="button"
                aria-label={showPw ? 'Нууц үгийг нуух' : 'Нууц үгийг харах'}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-black/5"
                disabled={loading}
              >
                {showPw ? <PiEyeBold size={18} /> : <PiEyeClosedBold size={18} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="inline-flex items-center gap-2 select-none text-black">
              <input type="checkbox" name="remember" className="accent-blue-500 text-black" disabled />
              Намайг сана
            </label>
            {/* Хэрэв "remember me" жинхэнэ утгатай болгох бол localStorage-д хадгалах client ашиглах хэрэгтэй */}
          </div>

          {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="bg-[#5AA6FF] w-full h-[40px] rounded-xl px-10 text-white text-[13px] font-medium hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Түр хүлээнэ үү…' : 'Нэвтрэх'}
          </button>
        </form>

        <p className="mt-4 text-[12px] text-center text-black/60">
          © {new Date().getFullYear()} Таны байгууллага
        </p>
      </div>
    </main>
  );
}
