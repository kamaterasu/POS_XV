// app/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import LoginPage from '@/app/login/page';

export default function Home() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard');
      else setChecked(true);
    });
  }, [router]);

  if (!checked) return null;     // эсвэл Loading UI тавьж болно
  return <LoginPage/>;
}
