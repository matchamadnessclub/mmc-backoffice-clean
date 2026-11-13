'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const TOPICS = ['🚨 เรื่องด่วน', '📦 ของหมด/ใกล้หมด', '🔧 อุปกรณ์เสีย', '🙋 ลูกค้า', '📝 อื่นๆ'];

export default function StaffMessageBox() {
  const [staffName, setStaffName] = useState('');
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [myMessages, setMyMessages] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('staff_name');
    if (saved) setStaffName(saved);
    fetchMessages();
  }, []);

  async function fetchMessages() {
    const { data } = await supabase
      .from('staff_messages')
      .select('id, staff_name, topic, message, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setMyMessages(data);
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!staffName.trim()) { alert('กรุณาใส่ชื่อของคุณก่อนส่ง'); return; }
    if (!message.trim()) { alert('กรุณาพิมพ์ข้อความ'); return; }

    setSending(true);
    localStorage.setItem('staff_name', staffName.trim());
    const { error } = await supabase.from('staff_messages').insert([{
      staff_name: staffName.trim(),
      topic,
      message: message.trim(),
      is_read: false
    }]);
    setSending(false);

    if (!error) {
      setMessage('');
      fetchMessages();
      alert('ส่งข้อความถึงเจ้าของร้านเรียบร้อย!');
    } else {
      alert('ส่งไม่สำเร็จ: ' + error.message);
    }
  }

  return (
    <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-4">
      <div className="border-b border-slate-300 pb-3">
        <h2 className="font-bold text-lg text-slate-800">📨 แจ้งเรื่องถึงเจ้าของร้าน</h2>
        <p className="text-xs text-slate-500">มีปัญหาหรือเรื่องที่ระบบไม่มีให้บันทึก แจ้งตรงนี้ได้เลย เจ้าของจะได้รับแจ้งเตือนทันที</p>
      </div>

      <form onSubmit={handleSend} className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input type="text" placeholder="ชื่อของคุณ" value={staffName} onChange={(e) => setStaffName(e.target.value)} className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" required />
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-bold text-slate-700">
            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <textarea rows="3" placeholder="พิมพ์รายละเอียด เช่น เครื่องบดเสียงดังผิดปกติ, นมเหลือ 1 กล่อง..." value={message} onChange={(e) => setMessage(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm outline-none font-medium" required></textarea>
        <button type="submit" disabled={sending} className="w-full bg-gradient-to-r from-slate-700 to-zinc-800 text-white font-bold py-2.5 rounded-xl text-sm shadow transition disabled:opacity-50">
          {sending ? 'กำลังส่ง...' : '📨 ส่งถึงเจ้าของร้าน'}
        </button>
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-700">ข้อความล่าสุดที่ส่งไป</h3>
        {myMessages.length > 0 ? myMessages.map(msg => (
          <div key={msg.id} className="bg-white p-3 rounded-xl border border-slate-300 shadow-sm">
            <div className="flex justify-between items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold text-slate-700">{msg.topic || 'ทั่วไป'} · {msg.staff_name}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${msg.is_read ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'}`}>
                {msg.is_read ? '✓ เจ้าของอ่านแล้ว' : '⏳ ยังไม่อ่าน'}
              </span>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.message}</p>
            <p className="text-[10px] text-slate-400 mt-1">{new Date(msg.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</p>
          </div>
        )) : <p className="text-xs text-slate-400 text-center py-3">ยังไม่มีข้อความ</p>}
      </div>
    </div>
  );
}