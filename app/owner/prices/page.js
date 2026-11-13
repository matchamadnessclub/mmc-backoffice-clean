'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { fmt, num, unitTh, OWNER_TABS } from '../../../lib/format';
import Shell from '../../../components/Shell';
import Loading from '../../../components/Loading';
import Message from '../../../components/Message';

function IngredientEditor({ ing, onDone, setMsg }) {
  const [packSize, setPackSize] = useState(ing.pack_size ?? '');
  const [packPrice, setPackPrice] = useState(ing.pack_price ?? '');
  const [unitCost, setUnitCost] = useState(ing.unit_cost ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  function recalc(size, price) {
    const s = num(size);
    const p = num(price);
    if (s && p !== null) setUnitCost(String(Math.round((p / s) * 100000) / 100000));
  }

  async function save() {
    const uc = num(unitCost);
    if (uc === null || uc < 0) {
      setMsg({ type: 'error', text: 'กรุณากรอก "ต้นทุนต่อหน่วย" เป็นตัวเลข' });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('ingredient_costs').insert({
      ingredient_id: ing.id,
      pack_size: num(packSize),
      pack_price: num(packPrice),
      unit_cost: uc,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: 'บันทึกราคาไม่สำเร็จ: ' + error.message });
      return;
    }
    setMsg({ type: 'ok', text: `อัปเดตราคา ${ing.name} แล้ว (เก็บประวัติราคาเดิมไว้)` });
    onDone();
  }

  const inputCls = 'w-full rounded-lg border border-stone-300 px-2 py-2 text-right';
  return (
    <div className="space-y-3 bg-emerald-50 px-3 py-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="mb-1 block text-stone-600">ขนาดแพ็ก ({unitTh(ing.unit)})</span>
          <input
            type="number" inputMode="decimal" step="any" className={inputCls} value={packSize}
            onChange={(e) => { setPackSize(e.target.value); recalc(e.target.value, packPrice); }}
          />
        </label>
        <label>
          <span className="mb-1 block text-stone-600">ราคาแพ็ก (บาท)</span>
          <input
            type="number" inputMode="decimal" step="any" className={inputCls} value={packPrice}
            onChange={(e) => { setPackPrice(e.target.value); recalc(packSize, e.target.value); }}
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-stone-600">ต้นทุนต่อ 1 {unitTh(ing.unit)} (บาท) — คำนวณให้เอง แก้เองได้</span>
        <input
          type="number" inputMode="decimal" step="any" className={inputCls} value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-stone-600">หมายเหตุ (ไม่บังคับ)</span>
        <input className="w-full rounded-lg border border-stone-300 px-2 py-2" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60">
          บันทึกราคาใหม่
        </button>
        <button onClick={onDone} className="rounded-lg bg-white px-4 py-2 text-stone-700 ring-1 ring-stone-300">
          ยกเลิก
        </button>
      </div>
    </div>
  );
}

function MenuEditor({ menu, onDone, setMsg }) {
  const [tp, setTp] = useState(menu.takeaway_price ?? '');
  const [dp, setDp] = useState(menu.delivery_price ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from('menu_prices').insert({
      menu_id: menu.id,
      takeaway_price: num(tp),
      delivery_price: num(dp),
    });
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: 'บันทึกราคาไม่สำเร็จ: ' + error.message });
      return;
    }
    setMsg({ type: 'ok', text: `อัปเดตราคา ${menu.name} แล้ว` });
    onDone();
  }

  const inputCls = 'w-full rounded-lg border border-stone-300 px-2 py-2 text-right';
  return (
    <div className="space-y-3 bg-emerald-50 px-3 py-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="mb-1 block text-stone-600">ราคาหน้าร้าน (บาท)</span>
          <input type="number" inputMode="decimal" step="any" className={inputCls} value={tp} onChange={(e) => setTp(e.target.value)} />
        </label>
        <label>
          <span className="mb-1 block text-stone-600">ราคาเดลิเวอรี (บาท)</span>
          <input type="number" inputMode="decimal" step="any" className={inputCls} value={dp} onChange={(e) => setDp(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60">
          บันทึกราคาใหม่
        </button>
        <button onClick={onDone} className="rounded-lg bg-white px-4 py-2 text-stone-700 ring-1 ring-stone-300">
          ยกเลิก
        </button>
      </div>
    </div>
  );
}

export default function PricesPage() {
  const auth = useAuth(['owner']);
  const [ings, setIngs] = useState([]);
  const [menus, setMenus] = useState([]);
  const [gp, setGp] = useState(0);
  const [gpInput, setGpInput] = useState('');
  const [editIng, setEditIng] = useState(null);
  const [editMenu, setEditMenu] = useState(null);
  const [msg, setMsg] = useState(null);

  async function loadData() {
    const [a, b, c, d, e, f] = await Promise.all([
      supabase.from('ingredients').select('id, name, category, unit').eq('active', true).order('category').order('name'),
      supabase.from('ingredient_current_cost').select('ingredient_id, unit_cost, pack_size, pack_price'),
      supabase.from('menus').select('id, name').eq('active', true).order('id'),
      supabase.from('menu_current_price').select('menu_id, takeaway_price, delivery_price'),
      supabase.from('menu_current_cost').select('menu_id, cost_per_cup'),
      supabase.from('app_settings').select('value').eq('key', 'delivery_gp').single(),
    ]);
    const err = a.error || b.error || c.error || d.error || e.error || f.error;
    if (err) {
      setMsg({ type: 'error', text: 'โหลดข้อมูลไม่สำเร็จ: ' + err.message });
      return;
    }
    const costBy = new Map(b.data.map((x) => [x.ingredient_id, x]));
    setIngs(a.data.map((i) => ({ ...i, ...(costBy.get(i.id) || {}) })));
    const priceBy = new Map(d.data.map((x) => [x.menu_id, x]));
    const cupBy = new Map(e.data.map((x) => [x.menu_id, x.cost_per_cup]));
    setMenus(c.data.map((m) => ({ ...m, ...(priceBy.get(m.id) || {}), cost: cupBy.get(m.id) ?? 0 })));
    setGp(Number(f.data.value));
    setGpInput(String(Math.round(Number(f.data.value) * 1000) / 10));
    setEditIng(null);
    setEditMenu(null);
  }

  useEffect(() => {
    if (!auth.loading) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading]);

  async function saveGp() {
    const pct = num(gpInput);
    if (pct === null || pct < 0 || pct > 100) {
      setMsg({ type: 'error', text: 'GP ต้องเป็นตัวเลข 0-100' });
      return;
    }
    const { error } = await supabase.from('app_settings').update({ value: pct / 100 }).eq('key', 'delivery_gp');
    if (error) setMsg({ type: 'error', text: 'บันทึก GP ไม่สำเร็จ: ' + error.message });
    else {
      setMsg({ type: 'ok', text: `ตั้ง GP เดลิเวอรีเป็น ${pct}% แล้ว` });
      loadData();
    }
  }

  if (auth.loading) return <Loading />;

  const groups = new Map();
  for (const i of ings) {
    const k = i.category || 'อื่นๆ';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  }

  return (
    <Shell auth={auth} title="ราคาและต้นทุน" tabs={OWNER_TABS}>
      <Message msg={msg} />
      <p className="mb-4 text-sm text-stone-600">
        แก้ราคาแล้วต้นทุนต่อแก้วและกำไรคำนวณใหม่ให้อัตโนมัติ ระบบเก็บประวัติราคาเดิมไว้ทุกครั้ง
      </p>

      <h2 className="mb-2 text-base font-semibold">เมนูและกำไร</h2>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-3 text-sm">
        <span>GP เดลิเวอรี (Grab / LINE MAN)</span>
        <input
          type="number" inputMode="decimal" step="any" value={gpInput}
          onChange={(e) => setGpInput(e.target.value)}
          className="w-20 rounded-lg border border-stone-300 px-2 py-1 text-right"
        />
        <span>%</span>
        <button onClick={saveGp} className="rounded-lg bg-emerald-700 px-3 py-1 text-white">บันทึก</button>
      </div>

      <div className="mb-6 divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
        {menus.map((m) => {
          const profitTake = m.takeaway_price != null ? Number(m.takeaway_price) - m.cost : null;
          const profitDeliv = m.delivery_price != null ? Number(m.delivery_price) * (1 - gp) - m.cost : null;
          return (
            <div key={m.id}>
              <div className="px-3 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-sm text-stone-500">ต้นทุน {fmt(m.cost)} บาท</div>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    หน้าร้าน {m.takeaway_price != null ? fmt(m.takeaway_price) : '-'}
                    <div className="text-xs text-stone-500">กำไร {fmt(profitTake)}</div>
                  </div>
                  <div>
                    เดลิเวอรี {m.delivery_price != null ? fmt(m.delivery_price) : '-'}
                    <div className="text-xs text-stone-500">กำไรหลังหัก GP {fmt(profitDeliv)}</div>
                  </div>
                </div>
                <button onClick={() => setEditMenu(m.id)} className="mt-2 text-sm text-emerald-700 underline">
                  แก้ราคาขาย
                </button>
              </div>
              {editMenu === m.id && <MenuEditor menu={m} onDone={loadData} setMsg={setMsg} />}
            </div>
          );
        })}
      </div>

      <h2 className="mb-2 text-base font-semibold">ราคาทุนวัตถุดิบ</h2>
      {[...groups.entries()].map(([cat, list]) => (
        <div key={cat} className="mb-4">
          <div className="mb-1 text-sm font-semibold text-emerald-800">{cat}</div>
          <div className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {list.map((i) => (
              <div key={i.id}>
                <div className="flex items-center justify-between gap-3 px-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate">{i.name}</div>
                    <div className="text-xs text-stone-500">
                      {i.unit_cost != null ? `${fmt(i.unit_cost, 4)} บาท/${unitTh(i.unit)}` : 'ยังไม่มีราคา'}
                      {i.pack_price != null && i.pack_size != null
                        ? ` · แพ็ก ${fmt(i.pack_size)} ${unitTh(i.unit)} = ${fmt(i.pack_price)} บาท`
                        : ''}
                    </div>
                  </div>
                  <button onClick={() => setEditIng(i.id)} className="shrink-0 text-sm text-emerald-700 underline">
                    แก้ราคา
                  </button>
                </div>
                {editIng === i.id && <IngredientEditor ing={i} onDone={loadData} setMsg={setMsg} />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </Shell>
  );
}
