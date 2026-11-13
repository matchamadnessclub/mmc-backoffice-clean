'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [role, setRole] = useState('staff'); // staff หรือ owner
  
  // สเตตฟอร์มพนักงาน
  const [staffUser, setStaffUser] = useState('');
  const [staffPass, setStaffPass] = useState('');

  // สเตตฟอร์มเจ้าของร้าน
  const [ownerPass, setOwnerPass] = useState('');

  const router = useRouter();

  function handleLogin(e) {
    e.preventDefault();

    if (role === 'owner') {
      // ตรวจสอบรหัสผ่านเจ้าของร้าน
      if (ownerPass === 'M@tchamadness2025') {
        localStorage.setItem('userRole', 'owner');
        router.push('/owner');
      } else {
        alert('รหัสผ่านเจ้าของร้านไม่ถูกต้องครับ!');
      }
    } else {
      // ตรวจสอบรหัสผ่านพนักงาน
      if (staffUser.trim() === 'matchamadnessclub' && staffPass === '012233') {
        localStorage.setItem('userRole', 'staff');
        localStorage.setItem('staffName', 'matchamadnessclub');
        router.push('/staff');
      } else {
        alert('ชื่อผู้ใช้งานหรือรหัสผ่านพนักงานไม่ถูกต้องครับ!\n(User: matchamadnessclub / Pass: 012233)');
      }
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-800 via-zinc-900 to-slate-950 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-100 to-zinc-200 border border-slate-400 shadow-2xl rounded-2xl max-w-md w-full p-8 space-y-6 text-slate-800">
        
        <div className="text-center space-y-2">
          <span className="text-4xl">☕</span>
          <h1 className="text-2xl font-black tracking-wide text-slate-900">ระบบจัดการร้านกาแฟ</h1>
          <p className="text-xs text-slate-600 font-medium">กรุณาเข้าสู่ระบบตามบทบาทของคุณ</p>
        </div>

        {/* ตัวเลือกสลับบทบาท */}
        <div className="grid grid-cols-2 gap-2 bg-slate-300 p-1 rounded-xl shadow-inner border border-slate-400">
          <button 
            type="button"
            onClick={() => setRole('staff')}
            className={`py-2 rounded-lg text-xs font-bold transition ${role === 'staff' ? 'bg-slate-800 text-white shadow' : 'text-slate-700 hover:bg-white/50'}`}
          >
            👩‍🍳 พนักงานหน้าร้าน
          </button>
          <button 
            type="button"
            onClick={() => setRole('owner')}
            className={`py-2 rounded-lg text-xs font-bold transition ${role === 'owner' ? 'bg-slate-800 text-white shadow' : 'text-slate-700 hover:bg-white/50'}`}
          >
            ⚙️ เจ้าของร้าน
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {role === 'staff' ? (
            <>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">ชื่อผู้ใช้งานพนักงาน (Username)</label>
                <input 
                  type="text" 
                  placeholder="matchamadnessclub" 
                  value={staffUser}
                  onChange={(e) => setStaffUser(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none font-medium shadow-inner"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">รหัสผ่านพนักงาน (Password)</label>
                <input 
                  type="password" 
                  placeholder="012233" 
                  value={staffPass}
                  onChange={(e) => setStaffPass(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none font-medium shadow-inner"
                  required
                />
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">รหัสผ่านเจ้าของร้าน (Owner Password)</label>
              <input 
                type="password" 
                placeholder="กรอกรหัสผ่านเจ้าของร้าน" 
                value={ownerPass}
                onChange={(e) => setOwnerPass(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none font-medium shadow-inner"
                required
              />
            </div>
          )}

          <button 
            type="submit"
            className="w-full bg-gradient-to-r from-slate-700 to-zinc-800 hover:from-slate-800 hover:to-zinc-900 text-white font-bold py-3 rounded-xl text-sm shadow-xl transition mt-2"
          >
            🚀 เข้าสู่ระบบ
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-500">
          ระบบจัดการสต็อกและยอดขาย Real-time เชื่อมต่อผ่าน Supabase
        </p>

      </div>
    </main>
  );
}