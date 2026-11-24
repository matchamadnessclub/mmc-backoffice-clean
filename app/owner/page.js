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

const OWNER_PASSWORD = '1234';

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
  const [dailyStaffStock, setDailyStaffStock] = useState({});
  const [allSalesHistory, setAllSalesHistory] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipesList, setRecipesList] = useState([]);
  const [staffLogs, setStaffLogs] = useState([]);
  const [promotionsList, setPromotionsList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal ยืนยันรหัสผ่านเจ้าของร้าน
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [ownerPasswordInput, setOwnerPasswordInput] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  // Modal แก้ไขยอดขาย & สต็อกรายวัน
  const [editingSalesModal, setEditingSalesModal] = useState(false);
  const [salesForm, setSalesForm] = useState({
    cash: '', qr: '', grab: '', lineman: '', grabth: '', linemanth: '', actual_cash: '', total_cups: '', staff_name: 'เจ้าของร้าน'
  });
  const [modalStockCounts, setModalStockCounts] = useState({});

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

  const [selectedMilkTypes, setSelectedMilkTypes] = useState({});
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

      const { data: stockRep } = await supabase.from('daily_staff_stocks').select('*').eq('date', selectedDate).maybeSingle();
      if (stockRep && stockRep.stock_data) {
        setDailyStaffStock(stockRep.stock_data);
      } else {
        setDailyStaffStock({});
      }

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

  function verifyOwnerPasswordAndExecute(actionCallback) {
    if (selectedDate !== todayLocal()) {
      setPendingAction(() => actionCallback);
      setShowPasswordModal(true);
    } else {
      actionCallback();
    }
  }

  function handlePasswordSubmit(e) {
    e.preventDefault();
    if (ownerPasswordInput === OWNER_PASSWORD) {
      setShowPasswordModal(false);
      setOwnerPasswordInput('');
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } else {
      alert('❌ รหัสผ่านเจ้าของร้านไม่ถูกต้อง!');
    }
  }

  function openEditSalesModal() {
    verifyOwnerPasswordAndExecute(() => {
      setSalesForm({
        cash: salesData?.cash ?? '',
        qr: salesData?.qr ?? '',
        grab: salesData?.grab ?? '',
        lineman: salesData?.lineman ?? '',
        grabth: salesData?.grabth ?? '',
        linemanth: salesData?.linemanth ?? '',
        actual_cash: salesData?.actual_cash ?? '',
        total_cups: salesData?.total_cups ?? '',
        staff_name: salesData?.staff_name || ownerName || 'เจ้าของร้าน'
      });

      const initialCounts = {};
      ingredients.forEach(i => {
        initialCounts[i.id] = dailyStaffStock[i.id] !== undefined ? dailyStaffStock[i.id] : getStock(i);
      });
      setModalStockCounts(initialCounts);
      setEditingSalesModal(true);
    });
  }

  async function handleSaveSalesAndStockUpdate(e) {
    e.preventDefault();
    const salesPayload = {
      date: selectedDate,
      cash: Number(salesForm.cash) || 0,
      qr: Number(salesForm.qr) || 0,
      grab: Number(salesForm.grab) || 0,
      lineman: Number(salesForm.lineman) || 0,
      grabth: Number(salesForm.grabth) || 0,
      linemanth: Number(salesForm.linemanth) || 0,
      actual_cash: Number(salesForm.actual_cash) || 0,
      total_cups: Number(salesForm.total_cups) || 0,
      staff_name: salesForm.staff_name || 'เจ้าของร้าน'
    };

    const stockPayload = {
      date: selectedDate,
      stock_data: modalStockCounts,
      updated_at: new Date().toISOString()
    };

    try {
      const { error: salesErr } = await supabase.from('daily_sales').upsert([salesPayload], { onConflict: 'date' });
      if (salesErr) throw salesErr;

      const { error: stockErr } = await supabase.from('daily_staff_stocks').upsert([stockPayload], { onConflict: 'date' });
      if (stockErr) throw stockErr;

      alert(`บันทึกยอดขายและสต็อกรายวันของวันที่ ${selectedDate} สำเร็จ!`);
      setEditingSalesModal(false);
      fetchOwnerData();
      fetchAllSalesHistory();
    } catch (err) {
      alert('บันทึกไม่สำเร็จ: ' + err.message);
    }
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

  async function handleSaveRecipeToDB() {
    if (!menuName.trim()) { alert('กรุณาใส่ชื่อเมนูก่อนครับ'); return; }
    const cleanItems = recipeItems.filter(item => item.ingredient_id !== '');
    const cogs = cleanItems.reduce((sum, item) => sum + getUnitCost(ingredients.find(i => i.id === Number(item.ingredient_id))) * Number(item.qty), 0);

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
      setMenuName(''); setRecipeItems([{ ingredient_id: '', qty: '' }]); setBasePrice(''); fetchOwnerData();
    } else { alert('Error: ' + error.message); }
  }

  async function handleUpdateRecipeModal(e) {
    e.preventDefault();
    if (!editingRecipeModal) return;
    const cleanItems = editingRecipeModal.ingredients_detail.filter(item => item.ingredient_id !== '');
    const cogs = cleanItems.reduce((sum, item) => sum + getUnitCost(ingredients.find(i => i.id === Number(item.ingredient_id))) * Number(item.qty), 0);

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

  function calculateRecipeCost(rec, milkType) {
    let totalCost = 0;
    (rec.ingredients_detail || []).forEach(item => {
      const orig = ingredients.find(i => i.id === Number(item.ingredient_id));
      if (!orig) return;
      let active = orig;

      if (rec.has_milk_option && milkType && milkType !== 'fresh') {
        const nameL = (orig.name || '').toLowerCase();
        if (orig.category === 'นม/ครีมเทียม' || nameL.includes('ray') || nameL.includes('milk') || nameL.includes('นม')) {
          const target = milkType === 'oat' ? 'oat milk lab' : 'almond milk';
          const found = ingredients.find(i => (i.name || '').toLowerCase().trim() === target);
          if (found) active = found;
        }
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

      {/* Modal ยืนยันรหัสผ่านเจ้าของร้าน */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-2xl rounded-2xl max-w-sm w-full p-6 space-y-4">
            <div className="text-center space-y-1">
              <span className="text-3xl">🔒</span>
              <h3 className="font-bold text-slate-800 text-base">รหัสผ่านยืนยันเจ้าของร้าน</h3>
              <p className="text-xs text-slate-500">คุณกำลังทำรายการแก้ไขข้อมูลย้อนหลังวันที่ (<span className="font-bold text-slate-700">{selectedDate}</span>) กรุณาใส่รหัสผ่าน</p>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <input type="password" placeholder="รหัสผ่านเจ้าของร้าน" value={ownerPasswordInput} onChange={(e) => setOwnerPasswordInput(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none font-medium text-center tracking-widest" autoFocus required />
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowPasswordModal(false); setOwnerPasswordInput(''); }} className="flex-1 bg-slate-200 font-bold py-2.5 rounded-xl text-xs">ยกเลิก</button>
                <button type="submit" className="flex-1 bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs shadow">ยืนยัน</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal แก้ไขยอดขาย & สต็อกรายวัน */}
      {editingSalesModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-2xl rounded-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-800 text-base">✏️ แก้ไขยอดขาย & สต็อกรายวัน ({selectedDate})</h3>
              <button onClick={() => setEditingSalesModal(false)} className="bg-slate-100 font-bold px-3 py-1 rounded-full text-xs">✕</button>
            </div>
            
            <form onSubmit={handleSaveSalesAndStockUpdate} className="space-y-5">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">💵 ยอดขายประจำวัน</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">ยอดเงินสด (฿)</label><input type="number" step="0.01" value={salesForm.cash} onChange={(e) => setSalesForm({...salesForm, cash: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" /></div>
                  <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">ยอด QR Code (฿)</label><input type="number" step="0.01" value={salesForm.qr} onChange={(e) => setSalesForm({...salesForm, qr: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" /></div>
                  <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">ยอด Grab (฿)</label><input type="number" step="0.01" value={salesForm.grab} onChange={(e) => setSalesForm({...salesForm, grab: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" /></div>
                  <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">ยอด LineMan (฿)</label><input type="number" step="0.01" value={salesForm.lineman} onChange={(e) => setSalesForm({...salesForm, lineman: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" /></div>
                  <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">ยอด GrabTH (฿)</label><input type="number" step="0.01" value={salesForm.grabth} onChange={(e) => setSalesForm({...salesForm, grabth: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" /></div>
                  <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">ยอด LineManTH (฿)</label><input type="number" step="0.01" value={salesForm.linemanth} onChange={(e) => setSalesForm({...salesForm, linemanth: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" /></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                  <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">เงินสดจริงในลิ้นชัก (฿)</label><input type="number" step="0.01" value={salesForm.actual_cash} onChange={(e) => setSalesForm({...salesForm, actual_cash: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" /></div>
                  <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">จำนวนแก้วรวม</label><input type="number" value={salesForm.total_cups} onChange={(e) => setSalesForm({...salesForm, total_cups: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" /></div>
                  <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">ผู้บันทึก</label><input type="text" value={salesForm.staff_name} onChange={(e) => setSalesForm({...salesForm, staff_name: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" /></div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">📦 สต็อกรายวัน (ที่พนักงานต้องกรอก)</h4>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {ingredients.filter(i => i.is_active !== false).map(ing => (
                    <div key={ing.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border text-xs gap-3">
                      <span className="font-bold text-slate-800 flex-1">{ing.name} <span className="text-slate-400">({ing.unit_type})</span></span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={modalStockCounts[ing.id] !== undefined ? modalStockCounts[ing.id] : getStock(ing)} 
                        onChange={(e) => setModalStockCounts({...modalStockCounts, [ing.id]: e.target.value})} 
                        className="w-32 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none font-bold text-right"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setEditingSalesModal(false)} className="w-1/3 bg-slate-200 font-bold py-2.5 rounded-xl text-sm">ยกเลิก</button>
                <button type="submit" className="w-2/3 bg-slate-800 text-white font-bold py-2.5 rounded-xl text-sm shadow">💾 บันทึกทั้งหมด</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            <button onClick={() => setSelectedSaleDetail(null)} className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-xl text-sm shadow">ปิดหน้าต่าง</button>
          </div>
        </div>
      )}

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

      {/* Main Container */}
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-slate-100 via-zinc-100 to-slate-200 shadow-xl rounded-2xl p-6 border border-slate-400 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">⚙️ ระบบจัดการร้านค้า</h1>
            <p className="text-sm text-slate-600 font-medium">ควบคุมยอดขาย สต็อก สูตรเครื่องดื่ม และพูดคุยภายใน</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/90 px-3 py-2 rounded-xl border border-slate-300 shadow-sm">
              <label className="text-xs font-bold text-slate-700">📅 เลือกดูวันที่:</label>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent text-sm font-semibold outline-none cursor-pointer" />
            </div>
            <button onClick={() => setActiveTab('messages')} className="relative bg-white w-11 h-11 rounded-2xl border border-slate-300 shadow-sm hover:bg-slate-50 flex items-center justify-center transition">
              <span className="text-xl">💬</span>
              {unreadMessages.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center border-2 border-white">{unreadMessages.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-300/80 p-1.5 rounded-2xl shadow-inner border border-slate-400 gap-1 overflow-x-auto text-xs md:text-sm">
          <button onClick={() => setActiveTab('sales')} className={tabClass('sales', activeTab)}>📊 ยอดขาย & สต็อกรายวัน</button>
          <button onClick={() => setActiveTab('ingredients')} className={tabClass('ingredients', activeTab)}>📦 จัดการวัตถุดิบ {lowStockItems.length > 0 && <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{lowStockItems.length}</span>}</button>
          <button onClick={() => setActiveTab('recipe')} className={tabClass('recipe', activeTab)}>🥤 สูตร & GP</button>
          <button onClick={() => setActiveTab('messages')} className={tabClass('messages', activeTab)}>💬 ข้อความ {unreadMessages.length > 0 && <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{unreadMessages.length}</span>}</button>
          <button onClick={() => setActiveTab('internal_chat')} className={tabClass('internal_chat', activeTab)}>💬 Internal Message</button>
          <button onClick={() => setActiveTab('promotions')} className={tabClass('promotions', activeTab)}>🏷️ โปรโมชัน</button>
          <button onClick={() => setActiveTab('staff_logs')} className={tabClass('staff_logs', activeTab)}>👥 ประวัติ</button>
        </div>

        {/* Tab 1: Sales & Daily Stock */}
        <div className={activeTab === 'sales' ? 'block' : 'hidden'}>
          <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-6">
            <div className="border-b border-slate-300 pb-3 flex justify-between items-center gap-2 flex-wrap">
              <div>
                <h2 className="font-bold text-lg text-slate-800">สรุปยอดขาย & สต็อกรายวัน ประจำวันที่ ({selectedDate})</h2>
                <p className="text-xs text-slate-500">พนักงานผู้บันทึก: <span className="font-bold">{salesData?.staff_name || 'ยังไม่บันทึก'}</span></p>
              </div>
              <button onClick={openEditSalesModal} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs shadow transition">
                ✏️ แก้ไขยอดขาย & สต็อกย้อนหลัง
              </button>
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
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">📦 สต็อกรายวันที่พนักงานต้องกรอก ({selectedDate})</h3>
                  {Object.keys(dailyStaffStock).length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {ingredients.filter(i => i.is_active !== false).map(ing => (
                        <div key={ing.id} className="bg-slate-50 p-2.5 rounded-xl border text-xs flex justify-between items-center">
                          <span className="font-bold text-slate-700 truncate mr-2">{ing.name}:</span>
                          <span className="font-black text-slate-900 shrink-0">{dailyStaffStock[ing.id] !== undefined ? dailyStaffStock[ing.id] : '-'} {ing.unit_type}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl text-center">ยังไม่มีการบันทึกสต็อกรายวันในวันที่เลือก (สามารถกดปุ่มแก้ไขด้านบนเพื่อเติมย้อนหลังได้)</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500 font-medium bg-white rounded-xl border border-slate-300 p-6 space-y-3">
                <p>ยังไม่มีข้อมูลการบันทึกปิดร้านของวันที่เลือก ({selectedDate})</p>
                <button onClick={openEditSalesModal} className="bg-slate-800 text-white font-bold px-5 py-2 rounded-xl text-xs shadow">+ เพิ่มยอดขาย & สต็อกของวันนี้</button>
              </div>
            )}
          </div>
        </div>

        {/* Tab 2: Ingredients */}
        <div className={activeTab === 'ingredients' ? 'block' : 'hidden'}>
          <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-6">
            <h2 className="font-bold text-lg text-slate-800 border-b border-slate-300 pb-3">จัดการราคาต้นทุนวัตถุดิบและสต็อก</h2>
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
              <button type="submit" className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-xl text-sm shadow">บันทึกเพิ่มวัตถุดิบ</button>
            </form>

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

        {/* Tab 3: Recipe */}
        <div className={activeTab === 'recipe' ? 'block' : 'hidden'}>
          <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-6">
            <h2 className="font-bold text-lg text-slate-800 border-b border-slate-300 pb-3">🥤 เพิ่มสูตรเครื่องดื่มใหม่ & คำนวณต้นทุน</h2>
            <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-300 shadow-sm">
              <input type="text" placeholder="ชื่อเมนู เช่น Latte, Americano, Matcha, Hojicha" value={menuName} onChange={(e) => setMenuName(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none font-medium" />
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
              <button onClick={handleSaveRecipeToDB} className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl text-sm shadow">💾 บันทึกสูตรนี้</button>
            </div>
          </div>
        </div>

        {/* Tab 4: Messages */}
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
                    <span className="text-[11px] text-slate-400">{formatTime(msg.created_at)}</span>
                  </div>
                  <p className="text-sm text-slate-700 line-clamp-2">{msg.message}</p>
                </div>
              )) : <p className="text-center py-8 text-slate-400 font-medium">ไม่มีข้อความจากพนักงาน</p>}
            </div>
          </div>
        </div>

        {/* Tab 5: Internal Chat */}
        <div className={activeTab === 'internal_chat' ? 'block' : 'hidden'}>
          <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-4">
            <div className="border-b border-slate-300 pb-3 flex justify-between items-center flex-wrap gap-2">
              <div>
                <h2 className="font-bold text-lg text-slate-800">💬 Internal Message (ห้องแชทเจ้าของ/หุ้นส่วน)</h2>
                <p className="text-xs text-slate-500">สื่อสารอัปเดตงาน ส่งรูป/ไฟล์ได้</p>
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
                      <p className={`text-[9px] text-right ${isMine ? 'text-slate-300' : 'text-slate-400'}`}>{formatTime(m.created_at)}</p>
                    </div>
                  </div>
                );
              }) : <p className="text-center text-xs text-slate-400 py-20">ยังไม่มีข้อความในห้องแชท</p>}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSendChat(); }} className="flex gap-2">
              <input type="file" id="chatFile" onChange={handleChatFileUpload} disabled={uploadingChatFile} className="hidden" />
              <label htmlFor="chatFile" className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm cursor-pointer flex items-center justify-center shrink-0">📎 แนบไฟล์</label>
              <input type="text" placeholder="พิมพ์ข้อความ..." value={chatText} onChange={(e) => setChatText(e.target.value)} className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none font-medium shadow-sm" />
              <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow transition shrink-0">ส่ง</button>
            </form>
          </div>
        </div>

        {/* Tab 6: Promotions */}
        <div className={activeTab === 'promotions' ? 'block' : 'hidden'}>
          <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-6">
            <h2 className="font-bold text-lg text-slate-800 border-b border-slate-300 pb-3">🏷️ จัดการโปรโมชันและเมนูใหม่</h2>
            <form onSubmit={handleSavePromotion} className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm space-y-4">
              <div><label className="block text-xs font-bold text-slate-600 mb-1">หัวข้อ</label><input type="text" value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium" required /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">รายละเอียด</label><textarea rows="3" value={promoDesc} onChange={(e) => setPromoDesc(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none font-medium"></textarea></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">แนบรูป/PDF</label><input type="file" accept="image/*,application/pdf" onChange={handlePromoFileUpload} className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-slate-700 file:text-white cursor-pointer" /></div>
              <button type="submit" className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-xl text-sm shadow">บันทึกโปรโมชัน</button>
            </form>
          </div>
        </div>

        {/* Tab 7: Staff Logs */}
        <div className={activeTab === 'staff_logs' ? 'block' : 'hidden'}>
          <div className="bg-slate-100 shadow-2xl rounded-2xl p-6 border border-slate-400 space-y-6">
            <h2 className="font-bold text-lg text-slate-800 border-b border-slate-300 pb-3">ประวัติการทำงานย้อนหลัง</h2>
            <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-200 font-bold border-b border-slate-300">
                    <th className="p-3">วันที่</th>
                    <th className="p-3">ผู้บันทึก</th>
                    <th className="p-3 text-center">แก้ว</th>
                    <th className="p-3 text-right">ยอดขายรวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {staffLogs.map(log => {
                    const rowTotal = ['cash', 'qr', 'grab', 'lineman', 'grabth', 'linemanth'].reduce((s, k) => s + (Number(log[k]) || 0), 0);
                    return (
                      <tr key={log.date} onClick={() => setSelectedSaleDetail(log)} className="hover:bg-slate-50 cursor-pointer transition">
                        <td className="p-3">{log.date}</td>
                        <td className="p-3 font-bold">{log.staff_name}</td>
                        <td className="p-3 text-center">{log.total_cups || 0}</td>
                        <td className="p-3 text-right text-emerald-700 font-bold">{rowTotal.toLocaleString()} ฿</td>
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