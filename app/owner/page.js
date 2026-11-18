 'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import imageCompression from 'browser-image-compression';

const CATEGORIES = ['เมล็ดกาแฟ/ชา', 'นม/ครีมเทียม', 'ไซรัป/ซอส/หวาน', 'บรรจุภัณฑ์/แก้ว', 'อื่นๆ'];
const RECIPE_CATEGORIES = [
  'ทั้งหมด', 
  '☕ Latte', 
  '☕ Americano', 
  '🍵 Matcha', 
  '🍵 Hojicha', 
  '🥛 โกโก้/นมสด (Cocoa/Milk)', 
  '🥤 เมนูอื่นๆ (Others)'
];

function getCategoryIcon(cat) {
  switch (cat) {
    case 'เมล็ดกาแฟ/ชา': return '☕';
    case 'นม/ครีมเทียม': return '🥛';
    case 'ไซรัป/ซอส/หวาน': return '🍯';
    case 'บรรจุภัณฑ์/แก้ว': return '🥤';
    default: return '📦';
  }
}

function toNumOr(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(value);
  return isNaN(n) ? fallback : n;
}
function getStock(i) { return toNumOr(i.current_stock, Number(i.total_unit) || 0); }
function getAlertLimit(i) { return toNumOr(i.min_stock_alert, (Number(i.total_unit) || 0) * 0.1); }
function isLowStock(i) { return getStock(i) <= getAlertLimit(i); }
function getUnitCost(ing) {
  if (!ing) return 0;
  const unitPrice = Number(ing.unit_price) || 0;
  if (unitPrice > 0) return unitPrice;
  const price = Number(ing.total_price) || 0;
  const unit = Number(ing.total_unit) || 0;
  return unit > 0 ? price / unit : 0;
}
function todayLocal() { return new Date().toLocaleDateString('en-CA'); }
function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
}

function getRecipeCategory(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('latte')) return '☕ Latte';
  if (n.includes('americano')) return '☕ Americano';
  if (n.includes('matcha')) return '🍵 Matcha';
  if (n.includes('hojicha')) return '🍵 Hojicha';
  if (n.includes('cocoa') || n.includes('milk') || n.includes('chocolate') || n.includes('โกโก้') || n.includes('นม')) {
    return '🥛 โกโก้/นมสด (Cocoa/Milk)';
  }
  return '🥤 เมนูอื่นๆ (Others)';
}

export default function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState('sales'); 
  const [selectedDate, setSelectedDate] = useState(todayLocal());
  const [salesData, setSalesData] = useState(null);
  const [expensesData, setExpensesData] = useState([]);
  const [allSalesHistory, setAllSalesHistory] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipesList, setRecipesList] = useState([]);
  const [staffLogs, setStaffLogs] = useState([]);
  const [promotionsList, setPromotionsList] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedSaleDetail, setSelectedSaleDetail] = useState(null);
  const [staffMessages, setStaffMessages] = useState([]);
  const [selectedStaffMsg, setSelectedStaffMsg] = useState(null);
  const [internalMsgs, setInternalMsgs] = useState([]);
  const [ownerName, setOwnerName] = useState('');
  const [chatText, setChatText] = useState('');
  const [uploadingChatFile, setUploadingChatFile] = useState(false);

  const [searchStockQuery, setSearchStockQuery] = useState('');
  const [stockSortType, setStockSortType] = useState('az');
  const [stockStatusFilter, setStockStatusFilter] = useState('all');
  const [ingName, setIngName] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [totalUnit, setTotalUnit] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [minStockAlert, setMinStockAlert] = useState('');
  const [unitType, setUnitType] = useState('g');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [editingIngredient, setEditingIngredient] = useState(null);

  const [menuName, setMenuName] = useState('');
  const [recipeItems, setRecipeItems] = useState([{ ingredient_id: '', qty: '' }]);
  const [targetGP, setTargetGP] = useState(30);
  const [basePrice, setBasePrice] = useState('');
  const [hasMilkOption, setHasMilkOption] = useState(false);
  const [hasTeaOption, setHasTeaOption] = useState(false); 

  const [selectedMilkTypes, setSelectedMilkTypes] = useState({});
  const [selectedTeaTypes, setSelectedTeaTypes] = useState({}); 

  const [editingRecipeModal, setEditingRecipeModal] = useState(null);
  const [recipeFilterCat, setRecipeFilterCat] = useState('ทั้งหมด');
  const [searchRecipeQuery, setSearchRecipeQuery] = useState('');

  const [promoTitle, setPromoTitle] = useState('');
  const [promoDesc, setPromoDesc] = useState('');
  const [promoFileUrl, setPromoFileUrl] = useState('');
  const [uploadingPromo, setUploadingPromo] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('owner_name');
    if (savedName) setOwnerName(savedName);

    fetchPromotions();
    fetchStaffMessages();
    fetchInternalMessages();
    fetchAllSalesHistory();

    const channel = supabase.channel('owner-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_messages' }, () => fetchStaffMessages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_messages' }, () => fetchInternalMessages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_sales' }, () => fetchAllSalesHistory())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => { fetchOwnerData(); }, [selectedDate]);

  async function fetchAllSalesHistory() {
    const { data } = await supabase.from('daily_sales').select('*').order('date', { ascending: false });
    if (data) setAllSalesHistory(data);
  }

  async function fetchOwnerData() {
    setLoading(true);
    try {
      const { data: sales } = await supabase.from('daily_sales').select('*').eq('date', selectedDate).maybeSingle();
      setSalesData(sales || null);

      const { data: exp } = await supabase.from('expenses').select('*').eq('date', selectedDate);
      setExpensesData(exp || []);

      const { data: ing } = await supabase.from('ingredients').select('*').order('category', { ascending: true });
      if (ing) setIngredients(ing);

      const { data: rec } = await supabase.from('recipes').select('*').order('menu_name');
      if (rec) setRecipesList(rec);

      const { data: logs } = await supabase.from('daily_sales').select('*').order('date', { ascending: false }).limit(30);
      if (logs) setStaffLogs(logs);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function fetchPromotions() {
    const { data } = await supabase.from('promotions').select('*').order('created_at', { ascending: false });
    if (data) setPromotionsList(data);
  }
  async function fetchStaffMessages() {
    const { data } = await supabase.from('staff_messages').select('*').order('created_at', { ascending: false }).limit(100);
    if (data) setStaffMessages(data);
  }
  async function fetchInternalMessages() {
    const { data } = await supabase.from('internal_messages').select('*').order('created_at', { ascending: true }).limit(200);
    if (data) setInternalMsgs(data);
  }

  const unreadMessages = staffMessages.filter(m => !m.is_read);
  const lowStockItems = ingredients.filter(i => i.is_active !== false && isLowStock(i));

  async function markMessageRead(msg) {
    if (!msg.is_read) {
      await supabase.from('staff_messages').update({ is_read: true }).eq('id', msg.id);
      fetchStaffMessages();
    }
    setSelectedStaffMsg({ ...msg, is_read: true });
  }
  async function handleDeleteStaffMessage(id) {
    if (!confirm('ต้องการลบข้อความนี้ใช่ไหม?')) return;
    const { error } = await supabase.from('staff_messages').delete().eq('id', id);
    if (!error) { setSelectedStaffMsg(null); fetchStaffMessages(); }
  }

  async function handleSendChat(fileUrl = null, fileType = null) {
    if (!ownerName.trim()) { alert('กรุณาใส่ชื่อผู้ส่งก่อนครับ'); return; }
    if (!chatText.trim() && !fileUrl) return;

    localStorage.setItem('owner_name', ownerName.trim());
    const { error } = await supabase.from('internal_messages').insert([{
      author: ownerName.trim(), message: chatText.trim(), file_url: fileUrl, file_type: fileType
    }]);

    if (!error) { setChatText(''); fetchInternalMessages(); }
    else { alert('ส่งไม่สำเร็จ: ' + error.message); }
  }

  async function handleChatFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingChatFile(true);
    try {
      let fileToUpload = file;
      let isImage = file.type.startsWith('image/');
      if (isImage) {
        fileToUpload = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1200, useWebWorker: true });
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `chat-${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from('sales-proofs').upload(fileName, fileToUpload);

      if (!error) {
        const { data } = supabase.storage.from('sales-proofs').getPublicUrl(fileName);
        if (data?.publicUrl) await handleSendChat(data.publicUrl, isImage ? 'image' : 'file');
      } else { alert('อัปโหลดไฟล์ไม่สำเร็จ: ' + error.message); }
    } catch (err) { console.error(err); alert('อัปโหลดไฟล์ไม่สำเร็จ'); }
    setUploadingChatFile(false);
  }

  async function handleSaveIngredient(e) {
    e.preventDefault();
    if (!ingName || !totalPrice || !totalUnit) return;
    const price = Number(totalPrice) || 0;
    const unit = Number(totalUnit) || 1;

    const payload = {
      name: ingName.trim(), total_price: price, total_unit: unit,
      current_stock: toNumOr(currentStock, unit), min_stock_alert: toNumOr(minStockAlert, unit * 0.1),
      unit_type: unitType, unit_price: price / unit, category: category, is_active: true
    };

    const { error } = await supabase.from('ingredients').insert([payload]);
    if (!error) {
      setIngName(''); setTotalPrice(''); setTotalUnit(''); setCurrentStock(''); setMinStockAlert('');
      setUnitType('g'); setCategory(CATEGORIES[0]); fetchOwnerData(); alert('เพิ่มวัตถุดิบสำเร็จ!');
    } else { alert('Error: ' + error.message); }
  }

  async function handleUpdateIngredientModal(e) {
    e.preventDefault();
    if (!editingIngredient) return;
    const price = Number(editingIngredient.total_price) || 0;
    const unit = Number(editingIngredient.total_unit) || 1;

    const payload = {
      name: (editingIngredient.name || '').trim(), total_price: price, total_unit: unit,
      current_stock: toNumOr(editingIngredient.current_stock, unit), min_stock_alert: toNumOr(editingIngredient.min_stock_alert, unit * 0.1),
      unit_type: editingIngredient.unit_type || 'g', unit_price: price / unit, category: editingIngredient.category || 'อื่นๆ'
    };

    const { error } = await supabase.from('ingredients').update(payload).eq('id', editingIngredient.id);
    if (!error) { setEditingIngredient(null); fetchOwnerData(); alert('อัปเดตวัตถุดิบสำเร็จ!'); }
    else { alert('Error: ' + error.message); }
  }

  async function toggleIngredientActive(ing) {
    const { error } = await supabase.from('ingredients').update({ is_active: ing.is_active === false }).eq('id', ing.id);
    if (!error) fetchOwnerData();
  }
  async function handleDeleteIngredient(id) {
    if (!confirm('ต้องการลบรายการนี้ใช่ไหมครับ?')) return;
    const { error } = await supabase.from('ingredients').delete().eq('id', id);
    if (!error) fetchOwnerData();
  }

  async function handleSaveRecipeToDB() {
    if (!menuName.trim()) { alert('กรุณาใส่ชื่อเมนูก่อนครับ'); return; }
    const cleanItems = recipeItems.filter(item => item.ingredient_id !== '');
    const cogs = cleanItems.reduce((sum, item) => sum + getUnitCost(ingredients.find(i => i.id === Number(item.ingredient_id))) * Number(item.qty), 0);

    // ส่งเฉพาะฟิลด์พื้นฐานที่มีในตาราง recipes ชัวร์ 100% ไม่ติด Schema Cache Error
    const payload = {
      menu_name: menuName.trim(), 
      cogs, 
      ingredients_detail: cleanItems,
      base_price: Number(basePrice) || 0,
      target_gp: Number(targetGP) || 30, 
      has_milk_option: hasMilkOption
    };

    const { error } = await supabase.from('recipes').insert([payload]);
    if (!error) {
      alert('บันทึกสูตรสำเร็จ!');
      setMenuName(''); setRecipeItems([{ ingredient_id: '', qty: '' }]); setBasePrice(''); setHasTeaOption(false); setHasMilkOption(false); fetchOwnerData();
    } else { alert('Error: ' + error.message); }
  }

  async function handleUpdateRecipeModal(e) {
    e.preventDefault();
    if (!editingRecipeModal) return;
    const cleanItems = editingRecipeModal.ingredients_detail.filter(item => item.ingredient_id !== '');
    const cogs = cleanItems.reduce((sum, item) => sum + getUnitCost(ingredients.find(i => i.id === Number(item.ingredient_id))) * Number(item.qty), 0);

    // ตัด has_tea_option ออกจากการอัปเดตลงฐานข้อมูล เพื่อป้องกันปัญหา Error คอลัมน์ยังไม่ถูกสร้างใน Supabase
    const payload = {
      menu_name: editingRecipeModal.menu_name.trim(), 
      cogs, 
      ingredients_detail: cleanItems,
      base_price: Number(editingRecipeModal.base_price) || 0,
      target_gp: Number(editingRecipeModal.target_gp) || 30,
      has_milk_option: editingRecipeModal.has_milk_option || false
    };

    const { error } = await supabase.from('recipes').update(payload).eq('id', editingRecipeModal.id);
    if (!error) { setEditingRecipeModal(null); fetchOwnerData(); alert('อัปเดตสูตรสำเร็จ!'); }
    else { alert('Error: ' + error.message); }
  }

  async function handleDeleteRecipe(id) {
    if (!confirm('ต้องการลบสูตรนี้ใช่ไหม?')) return;
    const { error } = await supabase.from('recipes').delete().eq('id', id);
    if (!error) fetchOwnerData();
  }

  // 🍵 คำนวณต้นทุนโดยเปิดให้ทุกเมนูที่มีส่วนผสมเป็นชา/มัทฉะ สามารถเลือกสลับผงชาได้ทันที
  function calculateRecipeCost(rec, milkType, teaIngId) {
    let totalCost = 0;
    (rec.ingredients_detail || []).forEach(item => {
      const orig = ingredients.find(i => i.id === Number(item.ingredient_id));
      if (!orig) return;
      let active = orig;

      // 1. เงื่อนไขเปลี่ยนชนิดนม
      if (rec.has_milk_option && milkType && milkType !== 'fresh') {
        const nameL = (orig.name || '').toLowerCase();
        if (orig.category === 'นม/ครีมเทียม' || nameL.includes('ray') || nameL.includes('milk') || nameL.includes('นม')) {
          const target = milkType === 'oat' ? 'oat milk lab' : 'almond milk';
          const found = ingredients.find(i => (i.name || '').toLowerCase().trim() === target);
          if (found) active = found;
        }
      }

      // 2. 🍵 เงื่อนไขเปลี่ยนผงชา (หากเมนูมีส่วนผสมเป็นชาหรือมัทฉะ จะเปิดให้เลือกเปลี่ยนผงชาได้อัตโนมัติทันที)
      const origCat = orig.category || '';
      const origName = (orig.name || '').toLowerCase();
      const isTeaItem = origCat === 'เมล็ดกาแฟ/ชา' || origName.includes('tea') || origName.includes('ชา') || origName.includes('matcha') || origName.includes('hojicha');

      if (isTeaItem && teaIngId && Number(teaIngId) > 0) {
        const foundTea = ingredients.find(i => i.id === Number(teaIngId));
        if (foundTea) active = foundTea;
      }

      totalCost += getUnitCost(active) * Number(item.qty);
    });
    return totalCost;
  }

  async function handlePromoFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPromo(true);
    let fileToUpload = file;
    if (file.type.startsWith('image/')) {
      fileToUpload = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1200, useWebWorker: true });
    }
    const fileName = `promo-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage.from('sales-proofs').upload(fileName, fileToUpload);
    if (!error) {
      const { data } = supabase.storage.from('sales-proofs').getPublicUrl(fileName);
      setPromoFileUrl(data.publicUrl);
    }
    setUploadingPromo(false);
  }

  async function handleSavePromotion(e) {
    e.preventDefault();
    if (!promoTitle.trim()) return;
    const { error } = await supabase.from('promotions').insert([{ title: promoTitle.trim(), description: promoDesc, file_url: promoFileUrl }]);
    if (!error) { setPromoTitle(''); setPromoDesc(''); setPromoFileUrl(''); fetchPromotions(); alert('บันทึกโปรโมชันสำเร็จ!'); }
  }
  async function handleDeletePromo(id) {
    if (!confirm('ลบโปรโมชันนี้ใช่ไหม?')) return;
    const { error } = await supabase.from('promotions').delete().eq('id', id);
    if (!error) fetchPromotions();
  }

  const totalSales = salesData ? ['cash', 'qr', 'grab', 'lineman', 'grabth', 'linemanth'].reduce((s, k) => s + (Number(salesData[k]) || 0), 0) : 0;
  const totalExpensesAmount = expensesData.reduce((sum, item) => sum + (Number(item.amount) || Number(item.price) || 0), 0);

  const now = new Date();
  const todayStr = todayLocal();
  const currentYear = now.getFullYear().toString();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const todayRecord = allSalesHistory.find(s => s.date === todayStr);
  const todaySalesSum = todayRecord ? ['cash', 'qr', 'grab', 'lineman', 'grabth', 'linemanth'].reduce((s, k) => s + (Number(todayRecord[k]) || 0), 0) : 0;
  const todayCupsSum = todayRecord ? Number(todayRecord.total_cups) || 0 : 0;

  const monthRecords = allSalesHistory.filter(s => s.date && s.date.startsWith(currentMonth));
  const monthSalesSum = monthRecords.reduce((acc, curr) => acc + ['cash', 'qr', 'grab', 'lineman', 'grabth', 'linemanth'].reduce((s, k) => s + (Number(curr[k]) || 0), 0), 0);
  const monthCupsSum = monthRecords.reduce((acc, curr) => acc + (Number(curr.total_cups) || 0), 0);

  const yearRecords = allSalesHistory.filter(s => s.date && s.date.startsWith(currentYear));
  const yearSalesSum = yearRecords.reduce((acc, curr) => acc + ['cash', 'qr', 'grab', 'lineman', 'grabth', 'linemanth'].reduce((s, k) => s + (Number(curr[k]) || 0), 0), 0);
  const yearCupsSum = yearRecords.reduce((acc, curr) => acc + (Number(curr.total_cups) || 0), 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 6);
  const weekRecords = allSalesHistory.filter(s => {
    if (!s.date) return false;
    const d = new Date(s.date);
    return d >= sevenDaysAgo && d <= now;
  });
  const weekSalesSum = weekRecords.reduce((acc, curr) => acc + ['cash', 'qr', 'grab', 'lineman', 'grabth', 'linemanth'].reduce((s, k) => s + (Number(curr[k]) || 0), 0), 0);
  const weekCupsSum = weekRecords.reduce((acc, curr) => acc + (Number(curr.total_cups) || 0), 0);

  function getFilteredStock(cat) {
    const q = searchStockQuery.trim().toLowerCase();
    return ingredients
      .filter(i => (i.category || 'อื่นๆ') === cat)
      .filter(i => (i.name || '').toLowerCase().includes(q))
      .filter(i => {
        if (stockStatusFilter === 'active') return i.is_active !== false;
        if (stockStatusFilter === 'inactive') return i.is_active === false;
        if (stockStatusFilter === 'low') return isLowStock(i);
        return true;
      })
      .sort((a, b) => {
        const byName = (a.name || '').localeCompare(b.name || '', 'th');
        if (stockSortType === 'za') return -byName;
        if (stockSortType === 'active_first') return (b.is_active !== false) - (a.is_active !== false) || byName;
        if (stockSortType === 'inactive_first') return (a.is_active !== false) - (b.is_active !== false) || byName;
        return byName;
      });
  }

  const filteredRecipes = recipesList.filter(rec => {
    const cat = getRecipeCategory(rec.menu_name);
    const matchCat = recipeFilterCat === 'ทั้งหมด' || cat === recipeFilterCat;
    const matchQuery = (rec.menu_name || '').toLowerCase().includes(searchRecipeQuery.trim().toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-200 via-zinc-300 to-slate-400 text-slate-800 p-4 md:p-8">

      {selectedSaleDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-2xl rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-base">📊 รายละเอียดการขายประจำวัน</h3>
                <p className="text-xs text-slate-500">วันที่: {selectedSaleDetail.date}</p>
              </div>
              <button onClick={() => setSelectedSaleDetail(null)} className="bg-slate-100 hover:bg-slate-200 font-bold px-3 py-1 rounded-full text-xs">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border text-xs">
              <div>พนักงานผู้บันทึก: <span className="font-bold">{selectedSaleDetail.staff_name || '-'}</span></div>
              <div>แก้วรวม: <span className="font-bold">{selectedSaleDetail.total_cups || 0} แก้ว</span></div>
              <div className="col-span-2">เงินสดจริงในลิ้นชัก: <span className="font-bold text-emerald-700">{(Number(selectedSaleDetail.actual_cash) || 0).toLocaleString()} ฿</span></div>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">💵 ยอดแยกตามช่องทาง</h4>
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border">
                <div>เงินสด: <span className="font-bold">{(Number(selectedSaleDetail.cash) || 0).toLocaleString()} ฿</span></div>
                <div>QR Code: <span className="font-bold">{(Number(selectedSaleDetail.qr) || 0).toLocaleString()} ฿</span></div>
                <div>Grab: <span className="font-bold">{(Number(selectedSaleDetail.grab) || 0).toLocaleString()} ฿</span></div>
                <div>LineMan: <span className="font-bold">{(Number(selectedSaleDetail.lineman) || 0).toLocaleString()} ฿</span></div>
                <div>GrabTH: <span className="font-bold">{(Number(selectedSaleDetail.grabth) || 0).toLocaleString()} ฿</span></div>
                <div>LineManTH: <span className="font-bold">{(Number(selectedSaleDetail.linemanth) || 0).toLocaleString()} ฿</span></div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">📸 รูปสลิปหลักฐานจากพนักงาน</h4>
              {Array.isArray(selectedSaleDetail.proof_images) && selectedSaleDetail.proof_images.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {selectedSaleDetail.proof_images.map((imgUrl, i) => (
                    <a key={i} href={imgUrl} target="_blank" rel="noopener noreferrer" className="block w-24 h-24 rounded-lg overflow-hidden border shadow-sm">
                      <img src={imgUrl} alt="slip" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl text-center">ไม่มีรูปแนบในวันนี้</p>}
            </div>

            <div className="pt-2">
              <button onClick={() => setSelectedSaleDetail(null)} className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-xl text-sm shadow">ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}

      {selectedStaffMsg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-2xl rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <span className="text-xs bg-slate-100 font-bold px-2.5 py-1 rounded-full text-slate-700">{selectedStaffMsg.topic || 'ทั่วไป'}</span>
              <button onClick={() => setSelectedStaffMsg(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1 rounded-full text-xs">✕</button>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-400">จากพนักงาน: <span className="font-bold text-slate-700">{selectedStaffMsg.staff_name}</span> ({formatTime(selectedStaffMsg.created_at)})</p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-200 font-medium">{selectedStaffMsg.message}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { markMessageRead(selectedStaffMsg); setSelectedStaffMsg(null); }} className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-xl text-sm shadow transition">✓ รับทราบ</button>
              <button onClick={() => handleDeleteStaffMessage(selectedStaffMsg.id)} className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-4 py-2.5 rounded-xl text-sm border border-red-200 transition">ลบ</button>
              <button onClick={() => setSelectedStaffMsg(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-sm transition">ปิด</button>
            </div>
          </div>
        </div>
      )}

      {editingIngredient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-2xl rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-800 text-base">✏️ แก้ไขวัตถุดิบ</h3>
              <button onClick={() => setEditingIngredient(null)} className="bg-slate-100 font-bold px-3 py-1 rounded-full text-xs">✕</button>
            </div>
            <form onSubmit={handleUpdateIngredientModal} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อ</label><input type="text" value={editingIngredient.name || ''} onChange={(e) => setEditingIngredient({ ...editingIngredient, name: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" required /></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1">หมวด</label>
                  <select value={editingIngredient.category || 'อื่นๆ'} onChange={(e) => setEditingIngredient({ ...editingIngredient, category: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-600 mb-1">ราคารวม (฿)</label><input type="number" step="0.01" value={editingIngredient.total_price ?? ''} onChange={(e) => setEditingIngredient({ ...editingIngredient, total_price: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" required /></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1">ปริมาณรวม</label><input type="number" step="0.01" value={editingIngredient.total_unit ?? ''} onChange={(e) => setEditingIngredient({ ...editingIngredient, total_unit: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" required /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label className="block text-xs font-semibold text-slate-600 mb-1">คงเหลือ</label><input type="number" step="0.01" value={editingIngredient.current_stock ?? ''} onChange={(e) => setEditingIngredient({ ...editingIngredient, current_stock: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1">แจ้งเตือนขั้นต่ำ</label><input type="number" step="0.01" value={editingIngredient.min_stock_alert ?? ''} onChange={(e) => setEditingIngredient({ ...editingIngredient, min_stock_alert: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1">หน่วย</label>
                  <select value={editingIngredient.unit_type || 'g'} onChange={(e) => setEditingIngredient({ ...editingIngredient, unit_type: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium">
                    <option value="g">g</option><option value="ml">ml</option><option value="pcs">pcs</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditingIngredient(null)} className="w-1/3 bg-slate-200 font-bold py-2.5 rounded-xl text-sm">ยกเลิก</button>
                <button type="submit" className="w-2/3 bg-slate-800 text-white font-bold py-2.5 rounded-xl text-sm shadow">💾 บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🍵 Popup Modal สำหรับแก้ไขสูตร */}
      {editingRecipeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-2xl rounded-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-800 text-base">✏️ แก้ไขสูตร</h3>
              <button onClick={() => setEditingRecipeModal(null)} className="bg-slate-100 font-bold px-3 py-1 rounded-full text-xs">✕</button>
            </div>
            <form onSubmit={handleUpdateRecipeModal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อเมนู</label>
                <input type="text" value={editingRecipeModal.menu_name || ''} onChange={(e) => setEditingRecipeModal({ ...editingRecipeModal, menu_name: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none font-medium" required />
              </div>
              
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!editingRecipeModal.has_milk_option} onChange={(e) => setEditingRecipeModal({ ...editingRecipeModal, has_milk_option: e.target.checked })} className="w-4 h-4 accent-slate-800" />
                  <span className="text-xs font-bold text-slate-700">🥛 เปลี่ยนชนิดนมได้</span>
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700">ส่วนผสมต่อ 1 แก้ว</label>
                  <button type="button" onClick={() => setEditingRecipeModal({ ...editingRecipeModal, ingredients_detail: [...editingRecipeModal.ingredients_detail, { ingredient_id: '', qty: '' }] })} className="text-xs bg-slate-700 text-white font-bold px-3 py-1 rounded-lg">+ เพิ่ม</button>
                </div>
                {editingRecipeModal.ingredients_detail.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select value={item.ingredient_id} onChange={(e) => {
                      const list = [...editingRecipeModal.ingredients_detail]; list[idx].ingredient_id = e.target.value;
                      setEditingRecipeModal({ ...editingRecipeModal, ingredients_detail: list });
                    }} className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium outline-none" required>
                      <option value="">-- เลือกวัตถุดิบ --</option>
                      {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit_type})</option>)}
                    </select>
                    <input type="number" step="0.01" placeholder="ปริมาณ" value={item.qty} onChange={(e) => {
                      const list = [...editingRecipeModal.ingredients_detail]; list[idx].qty = e.target.value;
                      setEditingRecipeModal({ ...editingRecipeModal, ingredients_detail: list });
                    }} className="w-24 bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium outline-none" required />
                    {editingRecipeModal.ingredients_detail.length > 1 && (
                      <button type="button" onClick={() => setEditingRecipeModal({ ...editingRecipeModal, ingredients_detail: editingRecipeModal.ingredients_detail.filter((_, i) => i !== idx) })} className="text-red-600 font-bold px-1">✕</button>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-slate-600 mb-1">ราคาหน้าร้าน</label><input type="number" value={editingRecipeModal.base_price ?? ''} onChange={(e) => setEditingRecipeModal({ ...editingRecipeModal, base_price: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1">GP (%)</label><input type="number" value={editingRecipeModal.target_gp ?? ''} onChange={(e) => setEditingRecipeModal({ ...editingRecipeModal, target_gp: e.target.value })} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditingRecipeModal(null)} className="w-1/3 bg-slate-200 font-bold py-2.5 rounded-xl text-sm">ยกเลิก</button>
                <button type="submit" className="w-2/3 bg-slate-800 text-white font-bold py-2.5 rounded-xl text-sm shadow">💾 บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-6">

        <div className="bg-gradient-to-r from-slate-100 via-zinc-100 to-slate-200 shadow-xl rounded-2xl p-6 border border-slate-400 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">⚙️ ระบบจัดการเจ้าของร้าน</h1>
            <p className="text-sm text-slate-600 font-medium">ควบคุมยอดขาย สต็อก สูตรเครื่องดื่ม และพูดคุยภายใน</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/90 px-3 py-2 rounded-xl border border-slate-300 shadow-sm">
              <label className="text-xs font-bold text-slate-700">📅 เลือกดูวันที่:</label>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent text-sm font-semibold outline-none cursor-pointer" />
            </div>

            <button onClick={() => setActiveTab('messages')} className="relative bg-white w-11 h-11 rounded-2xl border border-slate-300 shadow-sm hover:bg-slate-50 flex items-center justify-center transition" title="ข้อความด่วนจากพนักงาน">
              <span className="text-xl">💬</span>
              {unreadMessages.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center border-2 border-white">
                  {unreadMessages.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex bg-slate-300/80 p-1.5 rounded-2xl shadow-inner border border-slate-400 gap-1 overflow-x-auto text-xs md:text-sm">
          <button onClick={() => setActiveTab('sales')} className={tabClass('sales', activeTab)}>📊 ยอดขาย</button>
          <button onClick={() => setActiveTab('ingredients')} className={tabClass('ingredients', activeTab)}>📦 สต็อก {lowStockItems.length > 0 && <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{lowStockItems.length}</span>}</button>
          <button onClick={() => setActiveTab('recipe')} className={tabClass('recipe', activeTab)}>🥤 สูตร & GP</button>
          <button onClick={() => setActiveTab('messages')} className={tabClass('messages', activeTab)}>💬 ข้อความ {unreadMessages.length > 0 && <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{unreadMessages.length}</span>}</button>
          <button onClick={() => setActiveTab('internal_chat')} className={tabClass('internal_chat', activeTab)}>💬 Internal Message</button>
          <button onClick={() => setActiveTab('promotions')} className={tabClass('promotions', activeTab)}>🏷️ โปรโมชัน</button>
          <button onClick={() => setActiveTab('staff_logs')} className={tabClass('staff_logs', activeTab)}>👥 ประวัติ</button>
        </div>

        <div className={activeTab === 'sales' ? 'block' : 'hidden'}>
          <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-6">
            <div className="border-b border-slate-300 pb-3 flex justify-between items-center gap-2 flex-wrap">
              <h2 className="font-bold text-lg text-slate-800">สรุปยอดขายประจำวัน ({selectedDate})</h2>
              <span className="text-xs bg-slate-300 text-slate-800 px-3 py-1 rounded-full font-bold border border-slate-400">พนักงานผู้บันทึก: {salesData?.staff_name || 'ยังไม่บันทึก'}</span>
            </div>

            {loading ? <p className="text-center text-slate-500 py-8">กำลังโหลด...</p> : salesData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm text-center"><p className="text-xs font-semibold text-slate-500 mb-1">ยอดขายรวม</p><p className="text-2xl font-black text-slate-800">{totalSales.toLocaleString()} บาท</p></div>
                  <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm text-center"><p className="text-xs font-semibold text-slate-500 mb-1">จำนวนแก้วรวม</p><p className="text-2xl font-black text-slate-800">{salesData.total_cups || 0} แก้ว</p></div>
                  <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm text-center"><p className="text-xs font-semibold text-slate-500 mb-1">เงินสดจริงในลิ้นชัก</p><p className="text-2xl font-black text-emerald-700">{(Number(salesData.actual_cash) || 0).toLocaleString()} บาท</p></div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">💵 แยกยอดขายตามช่องทาง</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div className="bg-slate-50 p-3 rounded-xl border">เงินสด: <span className="font-bold text-slate-800">{(Number(salesData.cash) || 0).toLocaleString()} ฿</span></div>
                    <div className="bg-slate-50 p-3 rounded-xl border">QR Code: <span className="font-bold text-slate-800">{(Number(salesData.qr) || 0).toLocaleString()} ฿</span></div>
                    <div className="bg-slate-50 p-3 rounded-xl border">Grab: <span className="font-bold text-slate-800">{(Number(salesData.grab) || 0).toLocaleString()} ฿</span></div>
                    <div className="bg-slate-50 p-3 rounded-xl border">LineMan: <span className="font-bold text-slate-800">{(Number(salesData.lineman) || 0).toLocaleString()} ฿</span></div>
                    <div className="bg-slate-50 p-3 rounded-xl border">GrabTH: <span className="font-bold text-slate-800">{(Number(salesData.grabth) || 0).toLocaleString()} ฿</span></div>
                    <div className="bg-slate-50 p-3 rounded-xl border">LineManTH: <span className="font-bold text-slate-800">{(Number(salesData.linemanth) || 0).toLocaleString()} ฿</span></div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider">💸 รายจ่ายเงินสดหน้าร้าน</h3>
                  {expensesData.length > 0 ? (
                    <div className="space-y-2">
                      {expensesData.map((exp, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border text-xs">
                          <span className="font-bold text-slate-700">• {exp.name || exp.expense_name}</span>
                          <span className="font-bold text-red-600">{(Number(exp.amount) || Number(exp.price) || 0).toLocaleString()} ฿</span>
                        </div>
                      ))}
                      <div className="text-right text-xs font-bold text-red-600 pt-1">
                        รวมรายจ่ายหน้าร้านทั้งสิ้น: {totalExpensesAmount.toLocaleString()} ฿
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl text-center">ไม่มีรายจ่ายหน้าร้านในวันนี้</p>
                  )}
                </div>

                {Array.isArray(salesData.proof_images) && salesData.proof_images.length > 0 && (
                  <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm space-y-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">📸 รูปหลักฐานการขาย / สลิปจากพนักงาน</h3>
                    <div className="flex gap-3 flex-wrap">
                      {salesData.proof_images.map((imgUrl, i) => (
                        <a key={i} href={imgUrl} target="_blank" rel="noopener noreferrer" className="block w-28 h-28 rounded-lg overflow-hidden border border-slate-300 shadow-sm hover:opacity-90 transition">
                          <img src={imgUrl} alt={`proof-${i}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : <div className="text-center py-10 text-slate-500 font-medium bg-white rounded-xl border border-slate-300 p-6">ยังไม่มีข้อมูลการบันทึกปิดร้านของวันที่เลือก ({selectedDate})</div>}

            <div className="space-y-3 pt-4 border-t border-slate-300">
              <h3 className="font-bold text-base text-slate-800">📋 รายการยอดขายย้อนหลังทั้งหมด (คลิกแถวเพื่อดูรายละเอียด & สลิป)</h3>
              <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-200 font-bold border-b border-slate-300 z-10">
                    <tr>
                      <th className="p-3">วันที่</th>
                      <th className="p-3">ผู้บันทึก</th>
                      <th className="p-3 text-center">แก้วรวม</th>
                      <th className="p-3 text-right">ยอดขายรวม</th>
                      <th className="p-3 text-center">ดูรายละเอียด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {allSalesHistory.length > 0 ? allSalesHistory.map(row => {
                      const rowTotal = ['cash', 'qr', 'grab', 'lineman', 'grabth', 'linemanth'].reduce((s, k) => s + (Number(row[k]) || 0), 0);
                      return (
                        <tr key={row.date} onClick={() => setSelectedSaleDetail(row)} className="hover:bg-slate-50 cursor-pointer transition">
                          <td className="p-3 font-bold">{row.date}</td>
                          <td className="p-3">{row.staff_name || '-'}</td>
                          <td className="p-3 text-center">{row.total_cups || 0} แก้ว</td>
                          <td className="p-3 text-right font-black text-emerald-700">{rowTotal.toLocaleString()} ฿</td>
                          <td className="p-3 text-center">
                            <span className="text-xs bg-slate-800 text-white px-3 py-1 rounded-lg font-bold">🔍 เปิดดู</span>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan="5" className="text-center py-8 text-slate-400">ยังไม่มีประวัติการขายในระบบ</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t-2 border-slate-300">
              <div className="flex items-center gap-2">
                <span className="text-xl">📈</span>
                <h3 className="font-black text-lg text-slate-800 uppercase tracking-wide">รายงานวิเคราะห์ยอดขาย (Sales Analytics)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm space-y-1">
                  <p className="text-xs font-bold text-slate-500 uppercase">📅 วันนี้ ({todayStr})</p>
                  <p className="text-xl font-black text-slate-800">{todaySalesSum.toLocaleString()} ฿</p>
                  <p className="text-xs text-slate-600 font-medium">จำนวนขาย: <span className="font-bold text-emerald-700">{todayCupsSum} แก้ว</span></p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm space-y-1">
                  <p className="text-xs font-bold text-slate-500 uppercase">📊 7 วันล่าสุด (สัปดาห์นี้)</p>
                  <p className="text-xl font-black text-slate-800">{weekSalesSum.toLocaleString()} ฿</p>
                  <p className="text-xs text-slate-600 font-medium">จำนวนขาย: <span className="font-bold text-emerald-700">{weekCupsSum} แก้ว</span></p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm space-y-1">
                  <p className="text-xs font-bold text-slate-500 uppercase">🗓️ เดือนนี้ ({currentMonth})</p>
                  <p className="text-xl font-black text-slate-800">{monthSalesSum.toLocaleString()} ฿</p>
                  <p className="text-xs text-slate-600 font-medium">จำนวนขาย: <span className="font-bold text-emerald-700">{monthCupsSum} แก้ว</span></p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm space-y-1">
                  <p className="text-xs font-bold text-slate-500 uppercase">🏆 ปีนี้ ({currentYear})</p>
                  <p className="text-xl font-black text-slate-800">{yearSalesSum.toLocaleString()} ฿</p>
                  <p className="text-xs text-slate-600 font-medium">จำนวนขาย: <span className="font-bold text-emerald-700">{yearCupsSum} แก้ว</span></p>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div className={activeTab === 'ingredients' ? 'block' : 'hidden'}>
          <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-6">
            <h2 className="font-bold text-lg text-slate-800 border-b border-slate-300 pb-3">จัดการราคาต้นทุนวัตถุดิบและสต็อก</h2>

            {lowStockItems.length > 0 && (
              <div className="bg-red-50 border-2 border-red-300 p-4 rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🚨</span>
                  <h3 className="font-black text-sm text-red-800 uppercase tracking-wide">แจ้งเตือนวัตถุดิบใกล้หมด ({lowStockItems.length} รายการที่ต้องรีบเติม)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {lowStockItems.map(item => (
                    <div key={item.id} className="bg-white border border-red-200 p-3 rounded-xl flex justify-between items-center shadow-xs">
                      <div>
                        <p className="font-bold text-xs text-slate-800">{item.name}</p>
                        <p className="text-[10px] text-red-600 font-bold">คงเหลือ: {getStock(item)} {item.unit_type} (ขั้นต่ำ: {getAlertLimit(item)})</p>
                      </div>
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg font-bold shrink-0">ใกล้หมด</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveIngredient} className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-700">➕ เพิ่มรายการวัตถุดิบใหม่</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input type="text" placeholder="ชื่อวัตถุดิบ" value={ingName} onChange={(e) => setIngName(e.target.value)} className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" required />
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium">
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <div className="flex gap-2">
                  <input type="number" step="0.01" placeholder="ราคารวม (฿)" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} className="w-1/2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" required />
                  <input type="number" step="0.01" placeholder="ปริมาณซื้อรวม" value={totalUnit} onChange={(e) => setTotalUnit(e.target.value)} className="w-1/2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" required />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                <div><label className="block text-xs font-semibold text-slate-600 mb-1">สต็อกคงเหลือ</label><input type="number" step="0.01" placeholder="เช่น 500" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1">แจ้งเตือนขั้นต่ำ</label><input type="number" step="0.01" placeholder="เช่น 100" value={minStockAlert} onChange={(e) => setMinStockAlert(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1">หน่วย</label>
                  <select value={unitType} onChange={(e) => setUnitType(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium">
                    <option value="g">กรัม (g)</option><option value="ml">มิลลิลิตร (ml)</option><option value="pcs">ชิ้น (pcs)</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-slate-700 to-zinc-800 text-white font-bold py-2.5 rounded-xl text-sm shadow transition">บันทึกเพิ่มวัตถุดิบ</button>
            </form>

            <div className="bg-white p-3 rounded-xl border border-slate-300 shadow-sm flex flex-col md:flex-row gap-2">
              <input type="text" placeholder="🔍 ค้นหาชื่อวัตถุดิบ..." value={searchStockQuery} onChange={(e) => setSearchStockQuery(e.target.value)} className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" />
              <select value={stockSortType} onChange={(e) => setStockSortType(e.target.value)} className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-bold text-slate-700 cursor-pointer">
                <option value="az">🔤 เรียง A ➔ Z</option>
                <option value="za">🔤 เรียง Z ➔ A</option>
                <option value="active_first">🟢 เปิดนับสต็อกขึ้นก่อน</option>
                <option value="inactive_first">🔴 ปิดนับสต็อกขึ้นก่อน</option>
              </select>
              <select value={stockStatusFilter} onChange={(e) => setStockStatusFilter(e.target.value)} className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-bold text-slate-700 cursor-pointer">
                <option value="all">📋 ทั้งหมด</option>
                <option value="active">🟢 เปิดนับ</option>
                <option value="inactive">🔴 ปิดนับ</option>
                <option value="low">🚨 ใกล้หมด</option>
              </select>
            </div>

            <div className="space-y-6">
              {CATEGORIES.map(cat => {
                const items = getFilteredStock(cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat} className="bg-white shadow-xl rounded-2xl p-5 border border-slate-300 space-y-3">
                    <h3 className="font-black text-base text-slate-800 bg-slate-200 px-4 py-2 rounded-xl border border-slate-300 flex items-center gap-2">
                      <span className="text-xl">{getCategoryIcon(cat)}</span> หมวดหมู่: {cat}
                    </h3>
                    <div className="divide-y divide-slate-200">
                      {items.map(ing => {
                        const stock = getStock(ing);
                        const isLow = isLowStock(ing);
                        const isActive = ing.is_active !== false;
                        return (
                          <div key={ing.id} className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 text-sm py-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-800">🔹 {ing.name}</span>
                                {isLow && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-300 animate-pulse">🚨 ใกล้หมด</span>}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                                  {isActive ? '🟢 เปิดนับ' : '🔴 ปิดนับ'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 font-medium mt-1">
                                ซื้อ {ing.total_price || '-'} ฿ / {ing.total_unit || '-'} {ing.unit_type}
                                <span className="text-emerald-700 font-bold ml-2">(ตก {getUnitCost(ing).toFixed(4)} ฿ / {ing.unit_type})</span>
                                <span className="text-slate-700 font-semibold ml-2">| คงเหลือ: {stock} {ing.unit_type}</span>
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => toggleIngredientActive(ing)} className={`text-xs font-bold px-3 py-1.5 rounded-lg border shadow-sm ${isActive ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300'}`}>{isActive ? 'ปิดการนับ' : 'เปิดการนับ'}</button>
                              <button onClick={() => setEditingIngredient({ ...ing })} className="text-slate-700 hover:bg-slate-100 text-xs font-bold px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg shadow-sm">✏️ แก้ไข</button>
                              <button onClick={() => handleDeleteIngredient(ing.id)} className="text-red-600 hover:bg-red-50 text-xs font-bold px-3 py-1.5 bg-white border border-red-300 rounded-lg shadow-sm">ลบ</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 🥤 แท็บสูตรเครื่องดื่ม */}
        <div className={activeTab === 'recipe' ? 'block' : 'hidden'}>
          <div className="space-y-6">
            <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-6">
              <h2 className="font-bold text-lg text-slate-800 border-b border-slate-300 pb-3">🥤 เพิ่มสูตรเครื่องดื่มใหม่ & คำนวณต้นทุน</h2>
              <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-300 shadow-sm">
                <input type="text" placeholder="ชื่อเมนู เช่น Latte, Americano, Matcha, Hojicha" value={menuName} onChange={(e) => setMenuName(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none font-medium" />
                
                {/* ตัวเลือกเปลี่ยนชนิดนม */}
                <div className="flex gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasMilkOption} onChange={(e) => setHasMilkOption(e.target.checked)} className="w-4 h-4 accent-slate-800 rounded" />
                    <span className="text-xs font-bold text-slate-700">🥛 เปลี่ยนชนิดนมได้</span>
                  </label>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center"><label className="text-xs font-bold text-slate-700">ส่วนผสมต่อ 1 แก้ว</label><button type="button" onClick={() => setRecipeItems([...recipeItems, { ingredient_id: '', qty: '' }])} className="text-xs bg-slate-700 text-white font-bold px-3 py-1.5 rounded-lg">+ เพิ่ม</button></div>
                  {recipeItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select value={item.ingredient_id} onChange={(e) => {
                        const list = [...recipeItems]; list[idx].ingredient_id = e.target.value; setRecipeItems(list);
                      }} className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium outline-none">
                        <option value="">-- เลือกวัตถุดิบ --</option>
                        {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit_type})</option>)}
                      </select>
                      <input type="number" step="0.01" placeholder="ปริมาณ" value={item.qty} onChange={(e) => {
                        const list = [...recipeItems]; list[idx].qty = e.target.value; setRecipeItems(list);
                      }} className="w-28 bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium outline-none" />
                      {recipeItems.length > 1 && <button type="button" onClick={() => setRecipeItems(recipeItems.filter((_, i) => i !== idx))} className="text-red-600 font-bold px-1">✕</button>}
                    </div>
                  ))}
                </div>
                <div className="bg-emerald-50 border border-emerald-300 p-3.5 rounded-xl flex justify-between items-center text-sm font-bold text-emerald-900">
                  <span>ต้นทุนรวม (COGS):</span>
                  <span className="text-lg font-black">{recipeItems.reduce((sum, it) => sum + getUnitCost(ingredients.find(i => i.id === Number(it.ingredient_id))) * Number(it.qty), 0).toFixed(2)} บาท</span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-slate-600 mb-1 block">ราคาหน้าร้าน</label><input type="number" placeholder="60" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm outline-none font-medium" /></div>
                  <div><label className="text-xs font-bold text-slate-600 mb-1 block">GP เดลิเวอรี (%)</label><input type="number" placeholder="30" value={targetGP} onChange={(e) => setTargetGP(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm outline-none font-medium" /></div>
                </div>
                <button onClick={handleSaveRecipeToDB} className="w-full bg-gradient-to-r from-emerald-700 to-teal-800 text-white font-bold py-3 rounded-xl text-sm shadow">💾 บันทึกสูตรนี้</button>
              </div>
            </div>

            <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-center gap-3 border-b border-slate-300 pb-3">
                <h3 className="font-bold text-lg text-slate-800">📋 สูตรทั้งหมด ({filteredRecipes.length} จาก {recipesList.length} เมนู)</h3>
                
                <div className="flex gap-2 w-full md:w-auto">
                  <input type="text" placeholder="🔍 ค้นหาชื่อเมนู..." value={searchRecipeQuery} onChange={(e) => setSearchRecipeQuery(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs outline-none font-medium w-full md:w-40" />
                  <select value={recipeFilterCat} onChange={(e) => setRecipeFilterCat(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs outline-none font-bold text-slate-700 cursor-pointer shadow-sm">
                    {RECIPE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRecipes.length > 0 ? filteredRecipes.map(rec => {
                  const mType = selectedMilkTypes[rec.id] || 'fresh';
                  const teaId = selectedTeaTypes[rec.id] || '';
                  const cogs = calculateRecipeCost(rec, mType, teaId);
                  const storePrice = Number(rec.base_price) || 0;
                  const gp = Number(rec.target_gp) || 30;
                  const storeProfit = storePrice > 0 ? storePrice - cogs : 0;
                  const recDelivery = storePrice > 0 && gp < 100 ? storePrice / (1 - gp / 100) : 0;
                  const netDeliveryProfit = recDelivery * (1 - gp / 100) - cogs;
                  const autoCat = getRecipeCategory(rec.menu_name);

                  // 🍵 ดึงรายชื่อผงชาจากสต็อก (หมวด เมล็ดกาแฟ/ชา) มาทำดรอปดาวน์ให้ทุกเมนูที่มีส่วนผสมเป็นชาอัตโนมัติ
                  const hasTeaInRecipe = (rec.ingredients_detail || []).some(item => {
                    const ing = ingredients.find(i => i.id === Number(item.ingredient_id));
                    if (!ing) return false;
                    const c = ing.category || '';
                    const name = (ing.name || '').toLowerCase();
                    return c === 'เมล็ดกาแฟ/ชา' || name.includes('tea') || name.includes('ชา') || name.includes('matcha') || name.includes('hojicha');
                  });
                  const teaOptionsList = ingredients.filter(i => (i.category || 'อื่นๆ') === 'เมล็ดกาแฟ/ชา' && i.is_active !== false);

                  return (
                    <div key={rec.id} className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <div>
                          <h4 className="font-bold text-slate-900 text-base">🥤 {rec.menu_name}</h4>
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">{autoCat}</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingRecipeModal(JSON.parse(JSON.stringify(rec)))} className="bg-amber-600 text-white text-xs px-2.5 py-1 rounded-lg font-bold">✏️ แก้ไข</button>
                          <button onClick={() => handleDeleteRecipe(rec.id)} className="bg-red-600 text-white text-xs px-2.5 py-1 rounded-lg font-bold">🗑️ ลบ</button>
                        </div>
                      </div>

                      {/* ตัวเลือกนม */}
                      {rec.has_milk_option && (
                        <div className="bg-amber-50 border border-amber-200 p-2 rounded-xl flex items-center justify-between text-xs">
                          <span className="font-bold text-amber-900">🥛 นม:</span>
                          <div className="flex gap-1">
                            {[['fresh', 'Fresh'], ['oat', 'Oat'], ['almond', 'Almond']].map(([k, l]) => (
                              <button key={k} onClick={() => setSelectedMilkTypes({ ...selectedMilkTypes, [rec.id]: k })} className={`px-2 py-1 rounded-lg font-bold border ${mType === k ? 'bg-slate-800 text-white' : 'bg-white text-slate-700'}`}>{l}</button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 🍵 ตัวเลือกเปลี่ยนผงชาอัตโนมัติสำหรับเมนูชา/มัทฉะ */}
                      {hasTeaInRecipe && (
                        <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl flex items-center justify-between text-xs">
                          <span className="font-bold text-emerald-900">🍵 ผงชา:</span>
                          <select value={teaId} onChange={(e) => setSelectedTeaTypes({ ...selectedTeaTypes, [rec.id]: e.target.value })} className="bg-white border border-emerald-300 rounded-lg p-1.5 text-xs font-bold outline-none max-w-[200px]">
                            <option value="">-- ใช้ผงชาตามสูตรตั้งต้น --</option>
                            {teaOptionsList.map(t => <option key={t.id} value={t.id}>{t.name} ({t.unit_type})</option>)}
                          </select>
                        </div>
                      )}

                      <div className="text-xs space-y-2 text-slate-600">
                        <div className="flex justify-between"><span>COGS:</span><span className="font-bold text-red-600">{cogs.toFixed(2)} ฿</span></div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-50 p-2.5 rounded-lg border">
                            <p className="font-bold text-slate-700 text-[11px]">🏪 หน้าร้าน</p>
                            <p>ราคา: {storePrice} ฿</p>
                            <p>กำไร: <span className="font-bold text-emerald-700">{storeProfit.toFixed(2)} ฿</span></p>
                          </div>
                          <div className="bg-emerald-50/70 p-2.5 rounded-lg border">
                            <p className="font-bold text-emerald-900 text-[11px]">🛵 เดลิเวอรี ({gp}%)</p>
                            <p>ควรขาย: {Math.ceil(recDelivery)} ฿</p>
                            <p>กำไร: <span className="font-bold text-emerald-700">{netDeliveryProfit.toFixed(2)} ฿</span></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }) : <p className="text-xs text-slate-400 text-center py-8 col-span-2">ไม่พบสูตรเครื่องดื่มตามหมวดหมู่หรือคำค้นหานี้</p>}
              </div>
            </div>
          </div>
        </div>

        <div className={activeTab === 'messages' ? 'block' : 'hidden'}>
          <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-4">
            <h2 className="font-bold text-lg text-slate-800 border-b border-slate-300 pb-3">📥 เรื่องที่พนักงานแจ้งเข้ามา ({staffMessages.length})</h2>
            <div className="space-y-3">
              {staffMessages.length > 0 ? staffMessages.map(msg => (
                <div key={msg.id} onClick={() => markMessageRead(msg)} className={`p-4 rounded-xl border shadow-sm space-y-2 cursor-pointer transition hover:shadow-md ${msg.is_read ? 'bg-white border-slate-300' : 'bg-blue-50 border-blue-300 border-l-4 border-l-blue-600'}`}>
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {!msg.is_read && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>}
                      <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{msg.topic || 'ทั่วไป'}</span>
                      <span className="font-bold text-slate-900 text-sm">👤 {msg.staff_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">{formatTime(msg.created_at)}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${msg.is_read ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'}`}>
                        {msg.is_read ? '✓ อ่านแล้ว' : '⏳ รออ่าน (คลิกเพื่อดู)'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 line-clamp-2">{msg.message}</p>
                </div>
              )) : <p className="text-center py-8 text-slate-400 font-medium">ไม่มีข้อความจากพนักงาน</p>}
            </div>
          </div>
        </div>

        <div className={activeTab === 'internal_chat' ? 'block' : 'hidden'}>
          <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-4">
            <div className="border-b border-slate-300 pb-3 flex justify-between items-center flex-wrap gap-2">
              <div>
                <h2 className="font-bold text-lg text-slate-800">💬 Internal Message (ห้องแชทเจ้าของ/หุ้นส่วน)</h2>
                <p className="text-xs text-slate-500">สื่อสารอัปเดตงาน ส่งรูป/ไฟล์ได้ (ระบบเก็บข้อมูลย้อนหลัง 3 เดือน)</p>
              </div>
              <input type="text" placeholder="ชื่อของคุณ เช่น พี่เอ" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs outline-none font-bold w-40 shadow-sm" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-300 p-4 h-[420px] overflow-y-auto flex flex-col gap-3 shadow-inner">
              {internalMsgs.length > 0 ? internalMsgs.map(m => {
                const isMine = ownerName.trim() !== '' && m.author === ownerName.trim();
                return (
                  <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] font-bold text-slate-500 px-1 mb-0.5">{m.author}</span>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm space-y-2 ${isMine ? 'bg-slate-800 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 border border-slate-200 rounded-bl-sm'}`}>
                      {m.message && <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>}
                      {m.file_url && m.file_type === 'image' && (
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="block max-w-xs rounded-lg overflow-hidden border border-slate-300">
                          <img src={m.file_url} alt="chat-img" className="w-full h-auto object-cover max-h-48" />
                        </a>
                      )}
                      {m.file_url && m.file_type !== 'image' && (
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer" className={`block text-xs font-bold underline p-2 rounded-lg border ${isMine ? 'bg-slate-700 text-blue-200 border-slate-600' : 'bg-white text-blue-600 border-slate-200'}`}>
                          📎 เปิดดูไฟล์แนบ
                        </a>
                      )}
                      <p className={`text-[9px] text-right ${isMine ? 'text-slate-300' : 'text-slate-400'}`}>{formatTime(m.created_at)}</p>
                    </div>
                  </div>
                );
              }) : <p className="text-center text-xs text-slate-400 py-20">ยังไม่มีข้อความในห้องแชท เริ่มพูดคุยกันได้เลย</p>}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSendChat(); }} className="flex gap-2">
              <input type="file" id="chatFile" onChange={handleChatFileUpload} disabled={uploadingChatFile} className="hidden" />
              <label htmlFor="chatFile" className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm cursor-pointer flex items-center justify-center shrink-0">
                📎 {uploadingChatFile ? 'กำลังส่ง...' : 'แนบไฟล์'}
              </label>
              <input type="text" placeholder="พิมพ์ข้อความ..." value={chatText} onChange={(e) => setChatText(e.target.value)} className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none font-medium shadow-sm" />
              <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow transition shrink-0">ส่ง</button>
            </form>
          </div>
        </div>

        <div className={activeTab === 'promotions' ? 'block' : 'hidden'}>
          <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-6">
            <h2 className="font-bold text-lg text-slate-800 border-b border-slate-300 pb-3">🏷️ จัดการโปรโมชันและเมนูใหม่</h2>
            <form onSubmit={handleSavePromotion} className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm space-y-4">
              <div><label className="block text-xs font-bold text-slate-600 mb-1">หัวข้อ</label><input type="text" value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" required /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">รายละเอียด</label><textarea rows="3" value={promoDesc} onChange={(e) => setPromoDesc(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium"></textarea></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">แนบรูป/PDF</label><input type="file" accept="image/*,application/pdf" onChange={handlePromoFileUpload} className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-slate-700 file:text-white cursor-pointer" /></div>
              <button type="submit" className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-xl text-sm shadow">บันทึกโปรโมชัน</button>
            </form>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {promotionsList.map(p => (
                <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm space-y-2">
                  <div className="flex justify-between items-start"><h4 className="font-bold text-sm">{p.title}</h4><button onClick={() => handleDeletePromo(p.id)} className="text-xs text-red-600 font-bold">ลบ</button></div>
                  <p className="text-xs text-slate-600">{p.description}</p>
                  {p.file_url && <a href={p.file_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 underline block">🔗 ดูไฟล์แนบ</a>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={activeTab === 'staff_logs' ? 'block' : 'hidden'}>
          <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-6">
            <h2 className="font-bold text-lg text-slate-800 border-b border-slate-300 pb-3">ประวัติการทำงานย้อนหลัง (คลิกแถวเพื่อดูรายละเอียดช่องทางและสลิป)</h2>
            <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-200 font-bold border-b border-slate-300">
                    <th className="p-3">วันที่</th>
                    <th className="p-3">ผู้บันทึก</th>
                    <th className="p-3 text-center">แก้ว</th>
                    <th className="p-3 text-right">เงินสด</th>
                    <th className="p-3 text-right">QR/เดลิเวอรี</th>
                    <th className="p-3 text-center">ตรวจสอบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {staffLogs.map(log => {
                    const totalChannelSum = (Number(log.cash) || 0) + (Number(log.qr) || 0) + (Number(log.grab) || 0) + (Number(log.lineman) || 0) + (Number(log.grabth) || 0) + (Number(log.linemanth) || 0);
                    return (
                      <tr key={log.date} onClick={() => setSelectedSaleDetail(log)} className="hover:bg-slate-50 cursor-pointer transition">
                        <td className="p-3">{log.date}</td>
                        <td className="p-3 font-bold">{log.staff_name}</td>
                        <td className="p-3 text-center">{log.total_cups || 0}</td>
                        <td className="p-3 text-right text-emerald-700 font-bold">{(Number(log.cash) || 0).toLocaleString()} ฿</td>
                        <td className="p-3 text-right">{totalChannelSum.toLocaleString()} ฿</td>
                        <td className="p-3 text-center">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg font-bold">🔍 ดูสลิป</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}

function tabClass(tab, currentTab) {
  return `flex-1 min-w-[100px] py-2.5 rounded-xl font-bold transition shadow-sm ${currentTab === tab ? 'bg-gradient-to-r from-slate-700 to-zinc-800 text-white' : 'text-slate-700 hover:bg-white/50'}`;
}