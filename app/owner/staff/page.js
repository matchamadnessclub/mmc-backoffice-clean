'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { OWNER_TABS } from '../../../lib/format';
import Shell from '../../../components/Shell';
import Loading from '../../../components/Loading';
import Message from '../../../components/Message';

export default function StaffNamesPage() {
  const auth = useAuth(['owner']);
  const [rows, setRows] = useState([]);
  const [newName, setNewName] = useState('');
  const [msg, setMsg] = useState(null);

  async function loadData() {
    const { data, error } = await supabase.from('staff_names').select('id, name, active').order('id');
    if (error) setMsg({ type: 'error', text: 'โหลดไม่สำเร็จ: ' + error.message });
    else setRows(data);
  }

  useEffect(() => {
    if (!auth.loading) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading]);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    const { error } = await supabase.from('staff_names').insert({ name });
    if (error) {
      setMsg({ type: 'error', text: error.code === '23505' ? 'มีชื่อนี้อยู่แล้ว' : 'เพิ่มไม่สำเร็จ: ' + error.message });
      return;
    }
    setNewName('');
    setMsg({ type: 'ok', text: `เพิ่ม ${name} แล้ว` });
    loadData();
  }

  async function toggle(r) {
    const { error } = await supabase.from('staff_names').update({ active: !r.active }).eq('id', r.id);
    if (error) setMsg({ type: 'error', text: 'แก้ไม่สำเร็จ: ' + error.message });
    else loadData();
  }

  if (auth.loading) return <Loading />;

  return (
    <Shell auth={auth} title="รายชื่อพนักงาน" tabs={OWNER_TABS}>
      <Message msg={msg} />
      <p className="mb-3 text-sm text-stone-600">
        ชื่อที่เปิดใช้งานจะขึ้นให้พนักงานเลือกตอนเบิกของ/นับสต๊อก คนที่ลาออกให้กด "ปิด" แทนการลบ เพื่อให้ประวัติเก่ายังอยู่
      </p>

      <div className="mb-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="ชื่อพนักงานใหม่"
          className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 py-3 text-base"
        />
        <button onClick={add} className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white">
          เพิ่ม
        </button>
      </div>

      <div className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between px-3 py-3">
            <div className={r.active ? '' : 'text-stone-400 line-through'}>{r.name}</div>
            <button
              onClick={() => toggle(r)}
              className={`rounded-lg px-3 py-1 text-sm ${
                r.active ? 'bg-stone-200 text-stone-700' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {r.active ? 'ปิด' : 'เปิดใช้งาน'}
            </button>
          </div>
        ))}
        {rows.length === 0 && <div className="p-3 text-stone-500">ยังไม่มีรายชื่อ</div>}
      </div>
    </Shell>
  );
}
