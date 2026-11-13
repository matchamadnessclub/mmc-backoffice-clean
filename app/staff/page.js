 'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import imageCompression from 'browser-image-compression';

const TOPICS = ['🚨 เรื่องด่วน', '📦 ของหมด/ใกล้หมด', '🔧 อุปกรณ์เสีย', '🙋 ลูกค้า', '📝 อื่นๆ'];
const CATEGORIES = ['เมล็ดกาแฟ/ชา', 'นม/ครีมเทียม', 'ไซรัป/ซอส/หวาน', 'บรรจุภัณฑ์/แก้ว', 'อื่นๆ'];

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function StaffPage() {
  const [activeTab, setActiveTab] = useState('sales'); // sales | stock | messages | internal_chat
  const [today] = useState(todayLocal());

  // ฟอร์มยอดขาย
  const [staffName, setStaffName] = useState('');
  const [cash, setCash] = useState('');
  const [qr, setQr] = useState('');
  const [grab, setGrab] = useState('');
  const [lineman, setLineMan] = useState('');
  const [grabth, setGrabth] = useState('');
  const [linemanth, setLineManTH] = useState('');
  const [totalCups, setTotalCups] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [expenses, setExpenses] = useState([{ name: '', amount: '' }]);
  const [proofImages, setProofImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // สต็อก
  const [ingredients, setIngredients] = useState([]);
  const [stockCounts, setStockCounts] = useState({});

  // ข้อความแจ้งเจ้าของ
  const [msgTopic, setMsgTopic] = useState(TOPICS[0]);
  const [messageText, setMessageText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [myMessages, setMyMessages] = useState([]);

  // Internal Message แชทกับเจ้าของ
  const [internalMsgs, setInternalMsgs] = useState([]);
  const [chatText, setChatText] = useState('');
  const [uploadingChatFile, setUploadingChatFile] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('staff_name');
    if (saved) setStaffName(saved);
    fetchIngredients();
    fetchStaffMessages();
    fetchExistingSales();
    fetchInternalMessages();

    const channel = supabase.channel('staff-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_messages' }, () => fetchStaffMessages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_messages' }, () => fetchInternalMessages())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchExistingSales() {
    const { data } = await supabase.from('daily_sales').select('*').eq('date', today).maybeSingle();
    if (data) {
      if (data.staff_name) setStaffName(data.staff_name);
      setCash(data.cash ?? ''); setQr(data.qr ?? ''); setGrab(data.grab ?? '');
      setLineMan(data.lineman ?? ''); setGrabth(data.grabth ?? ''); setLineManTH(data.linemanth ?? '');
      setTotalCups(data.total_cups ?? ''); setActualCash(data.actual_cash ?? '');
      if (Array.isArray(data.proof_images)) setProofImages(data.proof_images);
    }
  }

  async function fetchIngredients() {
    const { data } = await supabase.from('ingredients').select('*').order('category');
    if (data) {
      setIngredients(data);
      const map = {};
      data.forEach(i => { map[i.id] = i.current_stock ?? i.total_unit; });
      setStockCounts(map);
    }
  }

  async function fetchStaffMessages() {
    const { data } = await supabase.from('staff_messages').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setMyMessages(data);
  }

  async function fetchInternalMessages() {
    const { data } = await supabase.from('internal_messages').select('*').order('created_at', { ascending: true }).limit(200);
    if (data) setInternalMsgs(data);
  }

  async function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    if (proofImages.length + files.length > 3) { alert('แนบหลักฐานได้สูงสุด 3 รูปครับ'); return; }

    setUploadingImage(true);
    const newUrls = [...proofImages];
    for (const file of files) {
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        fileToUpload = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1200, useWebWorker: true });
      }
      const fileName = `proof-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error } = await supabase.storage.from('sales-proofs').upload(fileName, fileToUpload);
      if (!error) {
        const { data } = supabase.storage.from('sales-proofs').getPublicUrl(fileName);
        if (data?.publicUrl) newUrls.push(data.publicUrl);
      }
    }
    setProofImages(newUrls);
    setUploadingImage(false);
  }

  async function handleSaveSales(e) {
    e.preventDefault();
    if (!staffName.trim()) { alert('กรุณากรอกชื่อพนักงาน'); return; }

    const payload = {
      date: today,
      staff_name: staffName.trim(),
      cash: Number(cash) || 0,
      qr: Number(qr) || 0,
      grab: Number(grab) || 0,
      lineman: Number(lineman) || 0,
      grabth: Number(grabth) || 0,
      linemanth: Number(linemanth) || 0,
      total_cups: Number(totalCups) || 0,
      actual_cash: Number(actualCash) || 0,
      proof_images: proofImages,
      updated_at: new Date()
    };

    const { error } = await supabase.from('daily_sales').upsert(payload, { onConflict: 'date' });
    if (!error) {
      localStorage.setItem('staff_name', staffName.trim());
      alert('บันทึกยอดขายสำเร็จ!');
    } else { alert('Error: ' + error.message); }
  }

  async function handleSaveStock() {
    if (!staffName.trim()) { alert('กรุณากรอกชื่อพนักงานก่อนบันทึกสต็อก'); return; }
    let abnormal = [];

    for (const ing of ingredients) {
      const newStock = Number(stockCounts[ing.id]);
      if (isNaN(newStock)) continue;
      const oldStock = Number(ing.current_stock ?? ing.total_unit ?? 0);

      if (newStock < 0) abnormal.push(`${ing.name} (ติดลบ: ${newStock})`);
      else if (oldStock > 50 && newStock < oldStock * 0.2) abnormal.push(`${ing.name} (ลดฮวบจาก ${oldStock} เหลือ ${newStock})`);

      await supabase.from('ingredients').update({ current_stock: newStock }).eq('id', ing.id);
    }

    if (abnormal.length > 0) {
      await supabase.from('staff_messages').insert([{
        staff_name: staffName.trim(),
        topic: '🚨 สต็อกผิดปกติ',
        message: `พนักงาน (${staffName.trim()}) บันทึกสต็อกผิดปกติ:\n- ${abnormal.join('\n- ')}`,
        is_read: false
      }]);
      alert('บันทึกสต็อกแล้ว แต่ระบบตรวจพบความผิดปกติ จึงส่งแจ้งเตือนด่วนถึงเจ้าของแล้วครับ!');
    } else {
      alert('บันทึกสต็อกสำเร็จ สต็อกปกติ!');
    }
    fetchIngredients();
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!staffName.trim() || !messageText.trim()) return;

    setSendingMsg(true);
    const { error } = await supabase.from('staff_messages').insert([{
      staff_name: staffName.trim(),
      topic: msgTopic,
      message: messageText.trim(),
      is_read: false
    }]);
    setSendingMsg(false);

    if (!error) {
      setMessageText('');
      fetchStaffMessages();
      alert('ส่งข้อความสำเร็จ!');
    }
  }

  async function handleSendChat(fileUrl = null, fileType = null) {
    if (!staffName.trim()) { alert('กรุณากรอกชื่อพนักงานก่อนส่งแชท'); return; }
    if (!chatText.trim() && !fileUrl) return;

    localStorage.setItem('staff_name', staffName.trim());
    await supabase.from('internal_messages').insert([{
      author: staffName.trim(),
      message: chatText.trim(),
      file_url: fileUrl,
      file_type: fileType
    }]);
    setChatText('');
    fetchInternalMessages();
  }

  async function handleChatFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingChatFile(true);
    let fileToUpload = file;
    let isImage = file.type.startsWith('image/');
    if (isImage) {
      fileToUpload = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1200, useWebWorker: true });
    }
    const fileName = `chat-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage.from('sales-proofs').upload(fileName, fileToUpload);
    if (!error) {
      const { data } = supabase.storage.from('sales-proofs').getPublicUrl(fileName);
      if (data?.publicUrl) await handleSendChat(data.publicUrl, isImage ? 'image' : 'file');
    }
    setUploadingChatFile(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-200 via-zinc-300 to-slate-400 text-slate-800 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="bg-gradient-to-r from-slate-100 via-zinc-100 to-slate-200 shadow-xl rounded-2xl p-6 border border-slate-400 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">☕ ระบบพนักงานหน้าร้าน</h1>
            <p className="text-sm text-slate-600">บันทึกยอดขาย นับสต็อก และพูดคุยภายใน</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-300 shadow-sm text-sm font-bold text-slate-700">📅 {today}</div>
        </div>

        {/* Tab พนักงาน */}
        <div className="flex bg-slate-300/80 p-1.5 rounded-2xl shadow-inner border border-slate-400 gap-1 text-xs md:text-sm overflow-x-auto">
          <button onClick={() => setActiveTab('sales')} className={`flex-1 py-2.5 rounded-xl font-bold transition shadow-sm ${activeTab === 'sales' ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-white/50'}`}>📊 ยอดขาย</button>
          <button onClick={() => setActiveTab('stock')} className={`flex-1 py-2.5 rounded-xl font-bold transition shadow-sm ${activeTab === 'stock' ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-white/50'}`}>📦 นับสต็อก</button>
          <button onClick={() => setActiveTab('messages')} className={`flex-1 py-2.5 rounded-xl font-bold transition shadow-sm ${activeTab === 'messages' ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-white/50'}`}>💬 แจ้งเจ้าของ</button>
          <button onClick={() => setActiveTab('internal_chat')} className={`flex-1 py-2.5 rounded-xl font-bold transition shadow-sm ${activeTab === 'internal_chat' ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-white/50'}`}>💬 แชททีมงาน</button>
        </div>

        {/* TAB 1: ยอดขาย + แนบรูป */}
        {activeTab === 'sales' && (
          <form onSubmit={handleSaveSales} className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-6">
            <h2 className="font-bold text-lg text-slate-800 border-b border-slate-300 pb-3">📝 บันทึกยอดขายประจำวัน</h2>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ชื่อพนักงาน</label>
              <input type="text" placeholder="น้องบี" value={staffName} onChange={(e) => setStaffName(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-300 space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase">ช่องทางการขาย</h3>
                <div><label className="text-xs text-slate-600 block mb-1">💵 เงินสด</label><input type="number" step="0.01" value={cash} onChange={(e) => setCash(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" /></div>
                <div><label className="text-xs text-slate-600 block mb-1">📱 QR Code</label><input type="number" step="0.01" value={qr} onChange={(e) => setQr(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" /></div>
                <div><label className="text-xs text-slate-600 block mb-1">🛵 Grab</label><input type="number" step="0.01" value={grab} onChange={(e) => setGrab(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" /></div>
                <div><label className="text-xs text-slate-600 block mb-1">🛵 LineMan</label><input type="number" step="0.01" value={lineman} onChange={(e) => setLineMan(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" /></div>
                <div><label className="text-xs text-slate-600 block mb-1">🛵 GrabTH</label><input type="number" step="0.01" value={grabth} onChange={(e) => setGrabth(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" /></div>
                <div><label className="text-xs text-slate-600 block mb-1">🛵 LineManTH</label><input type="number" step="0.01" value={linemanth} onChange={(e) => setLineManTH(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" /></div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-300 space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase">สรุปยอด</h3>
                <div><label className="text-xs text-slate-600 block mb-1">🥤 จำนวนแก้วรวม</label><input type="number" value={totalCups} onChange={(e) => setTotalCups(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm font-bold" /></div>
                <div><label className="text-xs text-slate-600 block mb-1">💰 เงินสดจริงในลิ้นชัก</label><input type="number" step="0.01" value={actualCash} onChange={(e) => setActualCash(e.target.value)} className="w-full bg-emerald-50 border border-emerald-300 rounded-lg p-2 text-sm font-bold text-emerald-800" /></div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-300 space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase">📸 แนบรูปหลักฐาน / สลิป (สูงสุด 3 รูป)</h3>
              <input type="file" accept="image/*" multiple onChange={handleImageUpload} disabled={uploadingImage || proofImages.length >= 3} className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-slate-700 file:text-white cursor-pointer" />
              {uploadingImage && <p className="text-xs text-slate-500 animate-pulse">กำลังอัปโหลด...</p>}
              {proofImages.length > 0 && (
                <div className="flex gap-2 flex-wrap pt-2">
                  {proofImages.map((url, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                      <img src={url} alt={`p-${idx}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setProofImages(proofImages.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs font-bold flex items-center justify-center">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button type="submit" className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl text-sm shadow">💾 บันทึกยอดขาย</button>
          </form>
        )}

        {/* TAB 2: สต็อก */}
        {activeTab === 'stock' && (
          <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-6">
            <h2 className="font-bold text-lg text-slate-800 border-b border-slate-300 pb-3">📦 ตรวจนับสต็อกวัตถุดิบ</h2>
            <div className="space-y-6">
              {CATEGORIES.map(cat => {
                const items = ingredients.filter(i => (i.category || 'อื่นๆ') === cat && i.is_active !== false);
                if (items.length === 0) return null;
                return (
                  <div key={cat} className="bg-white p-5 rounded-xl border shadow-sm space-y-3">
                    <h3 className="font-bold text-sm bg-slate-200 px-3 py-1.5 rounded-lg">{cat}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {items.map(ing => (
                        <div key={ing.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border">
                          <span className="text-xs font-bold">{ing.name} ({ing.unit_type})</span>
                          <input type="number" step="0.01" value={stockCounts[ing.id] ?? ''} onChange={(e) => setStockCounts({ ...stockCounts, [ing.id]: e.target.value })} className="w-24 bg-white border rounded-lg px-2 py-1 text-xs text-center font-bold outline-none" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={handleSaveStock} className="w-full bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm shadow">💾 บันทึกนับสต็อก</button>
          </div>
        )}

        {/* TAB 3: แจ้งเจ้าของ */}
        {activeTab === 'messages' && (
          <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-6">
            <h2 className="font-bold text-lg text-slate-800 border-b border-slate-300 pb-3">💬 แจ้งเรื่องด่วนถึงเจ้าของร้าน</h2>
            <form onSubmit={handleSendMessage} className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="text" placeholder="ชื่อพนักงาน" value={staffName} onChange={(e) => setStaffName(e.target.value)} className="bg-slate-50 border rounded-xl px-3 py-2 text-sm outline-none font-medium" required />
                <select value={msgTopic} onChange={(e) => setMsgTopic(e.target.value)} className="bg-slate-50 border rounded-xl px-3 py-2 text-sm outline-none font-bold">
                  {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <textarea rows="3" placeholder="รายละเอียด..." value={messageText} onChange={(e) => setMessageText(e.target.value)} className="w-full bg-slate-50 border rounded-xl p-3 text-sm outline-none font-medium" required></textarea>
              <button type="submit" disabled={sendingMsg} className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-xl text-sm shadow">📨 ส่งข้อความ</button>
            </form>
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700">ประวัติข้อความ</h3>
              {myMessages.map(msg => (
                <div key={msg.id} className="bg-white p-4 rounded-xl border shadow-sm space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold">[{msg.topic}] โดย {msg.staff_name}</span>
                    <span className={`font-bold px-2 py-0.5 rounded-full border ${msg.is_read ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'}`}>
                      {msg.is_read ? '✓ เจ้าของอ่านแล้ว' : '⏳ รออ่าน'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{msg.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: INTERNAL MESSAGE (ห้องแชทสไตล์ LINE) */}
        {activeTab === 'internal_chat' && (
          <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-4">
            <div className="border-b border-slate-300 pb-3 flex justify-between items-center flex-wrap gap-2">
              <div>
                <h2 className="font-bold text-lg text-slate-800">💬 แชททีมงาน (Internal Message)</h2>
                <p className="text-xs text-slate-500">พูดคุยอัปเดตงาน ส่งรูป/ไฟล์ได้</p>
              </div>
              <input type="text" placeholder="ชื่อของคุณ เช่น น้องบี" value={staffName} onChange={(e) => setStaffName(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs outline-none font-bold w-40 shadow-sm" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-300 p-4 h-[420px] overflow-y-auto flex flex-col gap-3 shadow-inner">
              {internalMsgs.length > 0 ? internalMsgs.map(m => {
                const isMine = staffName.trim() !== '' && m.author === staffName.trim();
                return (
                  <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] font-bold text-slate-500 px-1 mb-0.5">{m.author}</span>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm space-y-2 ${isMine ? 'bg-slate-800 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 border border-slate-200 rounded-bl-sm'}`}>
                      {m.message && <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>}
                      {m.file_url && m.file_type === 'image' && (
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="block max-w-xs rounded-lg overflow-hidden border">
                          <img src={m.file_url} alt="chat-img" className="w-full h-auto object-cover max-h-48" />
                        </a>
                      )}
                      {m.file_url && m.file_type !== 'image' && (
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="block text-xs font-bold underline p-2 rounded-lg border bg-white text-blue-600">📎 เปิดดูไฟล์แนบ</a>
                      )}
                      <p className={`text-[9px] text-right ${isMine ? 'text-slate-300' : 'text-slate-400'}`}>{new Date(m.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                  </div>
                );
              }) : <p className="text-center text-xs text-slate-400 py-20">ยังไม่มีข้อความ</p>}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSendChat(); }} className="flex gap-2">
              <input type="file" id="staffChatFile" onChange={handleChatFileUpload} disabled={uploadingChatFile} className="hidden" />
              <label htmlFor="staffChatFile" className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm cursor-pointer flex items-center justify-center shrink-0">
                📎 {uploadingChatFile ? 'กำลังส่ง...' : 'แนบไฟล์'}
              </label>
              <input type="text" placeholder="พิมพ์ข้อความ..." value={chatText} onChange={(e) => setChatText(e.target.value)} className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none font-medium shadow-sm" />
              <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow transition shrink-0">ส่ง</button>
            </form>
          </div>
        )}

      </div>
    </main>
  );
}