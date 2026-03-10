import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Trash2, Download, Share2, Save, History, 
  Users, Package, FileText, ChevronRight, Search, 
  Settings, UserCircle, Globe, AlertCircle, Copy,
  CheckCircle2, Printer, Eye, LogOut, Edit3, UserPlus, X, Lock,
  ChevronDown, Loader2
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// --- Firebase 初始化設定 ---
let app, auth, db, appId;
try {
  if (typeof __firebase_config !== 'undefined') {
    const firebaseConfig = JSON.parse(__firebase_config);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  }
} catch (e) {
  console.error("Firebase 初始化失敗:", e);
}

// --- 初期預設資料 (供首次建立資料庫時寫入使用) ---
const INITIAL_PRODUCTS = [
  { id: 'vc-001', sku: 'VC-A71P', name: '4K IP PTZ 攝像機', spec: '4K 60fps, 30x 光學變焦, HDMI/SDI/Ethernet', category: 'VC攝像機', price: 2500 },
  { id: 'vc-002', sku: 'VC-A51P', name: 'Full HD IP PTZ 攝像機', spec: '1080p 60fps, 20x 光學變焦, PoE+', category: 'VC攝像機', price: 1800 },
  { id: 'vc-003', sku: 'VC-TR40', name: 'AI 自動追蹤攝像機', spec: 'AI 智慧追蹤, 1080p, 20x 變焦, 雙鏡頭', category: 'VC攝像機', price: 2200 },
  { id: 'kb-001', sku: 'VS-KB30', name: 'IP 攝像機控制器', spec: '支援 VISCA/Pelco, LCD 顯示螢幕, 搖桿控制', category: 'KB控制器', price: 800 },
  { id: 'oip-001', sku: 'OIP-D50C', name: '1G 分散式編解碼器', spec: '4K 傳輸, 網路控制, 低延遲', category: 'OIP橋接器', price: 1200 },
];

const INITIAL_CUSTOMERS = [
  { id: 'c1', name: '台北影音整合有限公司', contact: '王大明', email: 'wang@example.com', level: '經銷商 A', discount: 0.7, address: '台北市信義區忠孝東路' },
  { id: 'c2', name: '雲端教育中心', contact: '李小姐', email: 'lee@edu.com', level: '一般客戶', discount: 1.0, address: '台中市西區台灣大道' },
];

const INITIAL_USERS = [
  { id: 'u1', username: 'admin', password: 'Lumens123', name: '系統管理員', role: 'Admin', company: 'LUMENS 總部', contact: '0912-345-678', email: 'admin@lumens.com' },
  { id: 'u2', username: 'sales01', password: 'user123', name: '業務專員 A', role: 'User', company: 'LUMENS 台灣分公司', contact: '0987-654-321', email: 'sales@lumens.com' },
];

const CURRENCIES = {
  CNY: { symbol: '¥', rate: 1, label: '人民幣' },
  USD: { symbol: '$', rate: 0.14, label: '美金' },
  EUR: { symbol: '€', rate: 0.13, label: '歐元' },
};

// 動態載入外部腳本 (供真實 PDF 生成使用)
const loadScript = (src) => new Promise((resolve, reject) => {
  if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
  const script = document.createElement('script');
  script.src = src;
  script.onload = resolve;
  script.onerror = reject;
  document.body.appendChild(script);
});

export default function App() {
  // --- 認證與雲端狀態 ---
  const [fbUser, setFbUser] = useState(null);
  const [isDbSyncing, setIsDbSyncing] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // --- 資料狀態 ---
  const [activeTab, setActiveTab] = useState('quotes');
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [currency, setCurrency] = useState('CNY');
  
  // --- 編輯狀態 ---
  const [isCreating, setIsCreating] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [tempSelection, setTempSelection] = useState({ category: '', sku: '', name: '' });
  const [editModal, setEditModal] = useState({ isOpen: false, type: '', mode: 'add', data: null });

  // --- Firebase 連線與資料同步 ---
  useEffect(() => {
    if (!auth) {
      // 若無 Firebase 環境，載入本地測試資料
      setProducts(INITIAL_PRODUCTS); setCustomers(INITIAL_CUSTOMERS); setUsers(INITIAL_USERS); setIsDbSyncing(false);
      return;
    }
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error("Firebase Auth 錯誤", e); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFbUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!fbUser || !db) return;
    setIsDbSyncing(true);

    const checkAndSeed = (snap, collectionName, initialData, setter) => {
      if (snap.empty) {
        initialData.forEach(item => setDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName, item.id), item));
      } else {
        setter(snap.docs.map(d => d.data()));
      }
    };

    const unsubProducts = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'products'), 
      snap => checkAndSeed(snap, 'products', INITIAL_PRODUCTS, setProducts), err => console.error(err));
      
    const unsubCustomers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'customers'), 
      snap => checkAndSeed(snap, 'customers', INITIAL_CUSTOMERS, setCustomers), err => console.error(err));
      
    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), 
      snap => checkAndSeed(snap, 'users', INITIAL_USERS, setUsers), err => console.error(err));
      
    const unsubQuotes = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'quotes'), 
      snap => {
        const fetchedQuotes = snap.docs.map(d => d.data()).sort((a,b) => b.id.localeCompare(a.id));
        setQuotes(fetchedQuotes);
        setIsDbSyncing(false);
      }, err => console.error(err));

    return () => { unsubProducts(); unsubCustomers(); unsubUsers(); unsubQuotes(); };
  }, [fbUser]);

  // --- 登入邏輯 ---
  const handleLogin = (e) => {
    e.preventDefault();
    const user = users.find(u => u.username === loginForm.username && u.password === loginForm.password);
    if (user) {
      setIsLoggedIn(true); setCurrentUser(user); setLoginError(''); setActiveTab('quotes');
    } else {
      setLoginError('帳號或密碼錯誤');
    }
  };

  const handleLogout = () => { setIsLoggedIn(false); setCurrentUser(null); setLoginForm({ username: '', password: '' }); };

  // --- 報價單邏輯 ---
  const generateQuoteID = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const count = (quotes.length + 1).toString().padStart(3, '0');
    return `PO${dateStr}${count}`;
  };

  const startNewQuote = () => {
    setCurrentQuote({
      id: generateQuoteID(), version: 1, createdAt: new Date().toLocaleDateString(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      customerName: '', userName: '', companyName: 'Lumens 科技',
      items: [], status: '已報價', currency: currency, taxRate: 0.05, notes: '', history: []
    });
    setIsCreating(true); setTempSelection({ category: '', sku: '', name: '' });
  };

  const confirmAddItem = () => {
    if (!tempSelection.sku) return;
    const product = products.find(p => p.sku === tempSelection.sku);
    const newItem = { ...product, quantity: 1, unitPrice: product.price, subtotal: product.price };
    setCurrentQuote({ ...currentQuote, items: [...currentQuote.items, newItem] });
    setTempSelection({ category: '', sku: '', name: '' });
  };

  const calculateTotals = (quote) => {
    if (!quote) return { subtotal: 0, tax: 0, total: 0 };
    const subtotal = quote.items.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * quote.taxRate;
    return { subtotal, tax, total: subtotal + tax };
  };

  const totals = useMemo(() => calculateTotals(currentQuote), [currentQuote]);

  // --- 真實 PDF 下載邏輯 ---
  const downloadAsPDF = async (quote) => {
    try {
      setIsGeneratingPDF(true);
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      
      const { jsPDF } = window.jspdf;
      const element = document.getElementById('pdf-preview-content'); // 定位預覽區塊
      
      // 擷取畫面
      const canvas = await window.html2canvas(element, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      
      // 轉換為 A4 尺寸的 PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${quote.id}_v${quote.version}.pdf`);
      
    } catch (err) {
      console.error("PDF 生成失敗:", err);
      alert("PDF 產出失敗，請檢查網路狀態後再試。");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const saveAndDownload = async () => {
    if (!currentQuote.userName) return alert('請填寫製單人員姓名');
    if (currentQuote.items.length === 0) return alert('請至少加入一個產品項目');

    try {
      // 寫入 Firestore 資料庫
      if (db && fbUser) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quotes', currentQuote.id), currentQuote);
      } else {
        setQuotes([currentQuote, ...quotes]); // 備用方案
      }
      
      setShowPreview(true); // 先開啟預覽畫面供截圖
      
      // 延遲一小段時間確保 React 渲染出預覽畫面後再截圖
      setTimeout(async () => {
        await downloadAsPDF(currentQuote);
        setShowPreview(false);
        setIsCreating(false);
      }, 500);

    } catch (err) {
      console.error(err); alert('儲存至資料庫失敗');
    }
  };

  // --- CRUD 資料庫操作 (產品/客戶/使用者) ---
  const openModal = (type, mode, item = null) => {
    let initialData = item ? { ...item } : (
      type === 'product' ? { sku: '', name: '', spec: '', category: 'VC攝像機', price: 0 }
      : type === 'customer' ? { name: '', contact: '', email: '', level: '一般客戶', discount: 1.0, address: '' }
      : { username: '', password: '', name: '', role: 'User', company: '', contact: '', email: '' }
    );
    setEditModal({ isOpen: true, type, mode, data: initialData });
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const { type, mode, data } = editModal;
    const targetCollection = type === 'product' ? 'products' : type === 'customer' ? 'customers' : 'users';
    const id = mode === 'add' ? `${type.charAt(0)}-${Date.now()}` : data.id;
    const payload = { ...data, id };

    try {
      if (db && fbUser) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', targetCollection, id), payload);
      } else {
        // 備用方案
        if (type === 'product') setProducts(mode==='add'?[payload, ...products]:products.map(p=>p.id===id?payload:p));
        if (type === 'customer') setCustomers(mode==='add'?[payload, ...customers]:customers.map(c=>c.id===id?payload:c));
        if (type === 'user') setUsers(mode==='add'?[payload, ...users]:users.map(u=>u.id===id?payload:u));
      }
      
      if (type === 'user' && currentUser && currentUser.id === id) setCurrentUser(payload);
      setEditModal({ isOpen: false, type: '', mode: 'add', data: null });
    } catch(err) { console.error(err); alert('資料儲存失敗'); }
  };

  const handleDeleteItem = async (type, id) => {
    const targetCollection = type === 'product' ? 'products' : type === 'customer' ? 'customers' : 'users';
    if (type === 'user' && id === currentUser.id) return alert('無法刪除目前登入的帳號');

    try {
      if (db && fbUser) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', targetCollection, id));
      } else {
         if (type === 'product') setProducts(products.filter(p => p.id !== id));
         if (type === 'customer') setCustomers(customers.filter(c => c.id !== id));
         if (type === 'user') setUsers(users.filter(u => u.id !== id));
      }
    } catch(err) { console.error(err); alert('資料刪除失敗'); }
  };

  // --- UI ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans relative">
        {isDbSyncing && (
           <div className="absolute top-4 right-4 bg-white px-4 py-2 rounded-lg shadow flex items-center gap-2 text-sm font-bold text-slate-500">
             <Loader2 size={16} className="animate-spin text-blue-600" /> 資料庫同步中...
           </div>
        )}
        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
          <div className="bg-slate-900 p-10 text-white text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-3xl italic mx-auto mb-4 shadow-lg shadow-blue-500/30">L</div>
            <h1 className="text-2xl font-bold tracking-tight">LUMENS 產品報價系統</h1>
          </div>
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            {loginError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 font-medium"><AlertCircle size={16} /> {loginError}</div>}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">帳號</label>
              <input type="text" required value={loginForm.username} onChange={(e) => setLoginForm({...loginForm, username: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="輸入 admin 或 sales01" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">密碼</label>
              <input type="password" required value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={isDbSyncing} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-4 rounded-xl shadow-lg transition transform active:scale-[0.98]">
              {isDbSyncing ? '系統連線中...' : '安全登入'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
      {/* 側邊選單 */}
      <aside className="w-full md:w-64 bg-slate-900 text-white p-6 flex flex-col shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-xl italic shadow-lg shadow-blue-500/20">L</div>
          <div><h1 className="font-bold text-lg leading-tight">LUMENS</h1><p className="text-[10px] text-slate-400 font-mono tracking-widest">{currentUser.role} MODE</p></div>
        </div>
        <nav className="space-y-2 flex-grow">
          <button onClick={() => {setActiveTab('quotes'); setIsCreating(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'quotes' ? 'bg-blue-600 shadow-lg shadow-blue-900/50 text-white' : 'hover:bg-slate-800 text-slate-400 font-medium'}`}><FileText size={20} /> 報價系統</button>
          {currentUser.role === 'Admin' && (
            <>
              <div className="px-4 pt-8 pb-3 text-[10px] uppercase font-bold text-slate-500 tracking-widest">系統管理控制台</div>
              <button onClick={() => setActiveTab('products')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'products' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 text-slate-400 font-medium'}`}><Package size={20} /> 產品庫管理</button>
              <button onClick={() => setActiveTab('customers')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'customers' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 text-slate-400 font-medium'}`}><Users size={20} /> 客戶管理</button>
              <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'users' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 text-slate-400 font-medium'}`}><Settings size={20} /> 帳號管理</button>
            </>
          )}
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold shadow-inner">{currentUser.name.slice(0,1)}</div>
            <div className="text-xs"><p className="font-bold truncate w-24 text-slate-200">{currentUser.name}</p><p className="text-[10px] text-slate-500">{currentUser.company}</p></div>
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"><LogOut size={18} /></button>
        </div>
      </aside>

      {/* 主內容區 */}
      <main className="flex-grow p-4 md:p-8 overflow-y-auto max-h-screen relative">
        {/* Loading Overlay for PDF */}
        {isGeneratingPDF && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-2xl">
            <Loader2 size={48} className="animate-spin text-blue-600 mb-4" />
            <h2 className="text-xl font-bold text-slate-800">正在生成高畫質 PDF...</h2>
            <p className="text-slate-500 mt-2">請稍候，下載即將開始。</p>
          </div>
        )}

        <header className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <h2 className="text-3xl font-bold tracking-tight">{isCreating ? '建立新報價單' : activeTab === 'quotes' ? '雲端報價記錄' : activeTab === 'products' ? '產品資料庫' : activeTab === 'users' ? '內部帳號管理' : '客戶聯絡資料'}</h2>
          <div className="flex gap-3">
            {activeTab === 'quotes' && !isCreating && (
              <button onClick={startNewQuote} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition"><Plus size={18} /> 新增報價</button>
            )}
            {activeTab === 'products' && (
              <button onClick={() => openModal('product', 'add')} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-lg shadow-slate-200 transition"><Plus size={18} /> 新增產品</button>
            )}
            {activeTab === 'customers' && (
              <button onClick={() => openModal('customer', 'add')} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-lg shadow-slate-200 transition"><UserPlus size={18} /> 新增客戶</button>
            )}
            {activeTab === 'users' && (
              <button onClick={() => openModal('user', 'add')} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-lg shadow-slate-200 transition"><UserPlus size={18} /> 新增帳號</button>
            )}
          </div>
        </header>

        {/* 報價清單 (首頁) */}
        {activeTab === 'quotes' && !isCreating && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-xs uppercase font-bold border-b border-slate-100 tracking-wider">
                <tr><th className="px-6 py-5">單號</th><th className="px-6 py-5">客戶與日期</th><th className="px-6 py-5">製單人</th><th className="px-6 py-5 text-right">總金額</th><th className="px-6 py-5 text-center">操作</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {quotes.length === 0 ? <tr><td colSpan="5" className="px-6 py-16 text-center text-slate-400 font-medium">資料庫中尚無報價單記錄</td></tr> : (
                  quotes.map(q => (
                    <tr key={q.id} className="hover:bg-blue-50/50 transition text-sm group">
                      <td className="px-6 py-4 font-mono font-bold text-blue-600">{q.id}</td>
                      <td className="px-6 py-4"><p className="font-bold text-slate-800">{q.customerName || '未指定'}</p><p className="text-xs text-slate-400">{q.createdAt}</p></td>
                      <td className="px-6 py-4 font-medium text-slate-600">{q.userName}</td>
                      <td className="px-6 py-4 font-black text-right text-slate-800">{CURRENCIES[q.currency].symbol} {calculateTotals(q).total.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => {setCurrentQuote(q); setShowPreview(true);}} className="p-2 bg-white text-slate-500 hover:text-blue-600 border border-slate-200 shadow-sm rounded-lg" title="預覽與下載"><Eye size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 報價單編輯介面 */}
        {activeTab === 'quotes' && isCreating && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              {/* 表頭資訊 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 pb-10 border-b border-slate-100">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">系統自動單號</label>
                  <p className="text-2xl font-mono font-black text-blue-600 bg-blue-50 inline-block px-3 py-1 rounded-lg">{currentQuote.id}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">製單人員 <span className="text-red-500">*</span></label>
                  <input type="text" value={currentQuote.userName} onChange={(e) => setCurrentQuote({...currentQuote, userName: e.target.value})} placeholder="請輸入您的姓名" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">指派客戶</label>
                  <select value={currentQuote.customerName} onChange={(e) => setCurrentQuote({...currentQuote, customerName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer">
                    <option value="">請選擇客戶庫...</option>
                    {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* 產品快速加入器 */}
              <div className="mb-10 bg-slate-50 p-6 rounded-2xl border border-slate-200 border-dashed">
                <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Package size={18} className="text-blue-600"/> 產品快速檢索加入</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">1. 選擇系列</label>
                    <select value={tempSelection.category} onChange={(e) => handleCategoryChange(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium shadow-sm outline-none cursor-pointer">
                      <option value="">全部系列...</option>
                      {[...new Set(products.map(p => p.category))].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">2. 選擇型號 (SKU)</label>
                    <select value={tempSelection.sku} disabled={!tempSelection.category} onChange={(e) => handleSkuChange(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium shadow-sm disabled:opacity-50 outline-none cursor-pointer">
                      <option value="">對應型號...</option>
                      {products.filter(p => p.category === tempSelection.category).map(p => <option key={p.id} value={p.sku}>{p.sku}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400">系統關聯品名</label>
                    <input type="text" readOnly value={tempSelection.name} placeholder="自動載入..." className="w-full px-4 py-2.5 bg-slate-100 border border-slate-100 rounded-xl text-sm text-slate-500 font-medium" />
                  </div>
                  <button onClick={confirmAddItem} disabled={!tempSelection.sku} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition disabled:bg-slate-300 shadow-sm">
                    <Plus size={18} /> 加入清單
                  </button>
                </div>
              </div>

              {/* 報價清單 Table */}
              <div className="space-y-3 mb-12">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">本次報價項目清單</h4>
                {currentQuote.items.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 border-2 border-slate-100 rounded-2xl bg-white border-dashed">
                     <Package size={48} className="mx-auto mb-3 text-slate-200" />
                     <p className="font-medium">尚未加入任何產品項目</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentQuote.items.map((item, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row gap-4 items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 transition group">
                        <div className="flex-grow">
                          <p className="font-bold text-blue-700 text-lg leading-tight">{item.sku}</p>
                          <p className="text-sm font-medium text-slate-500">{item.name}</p>
                        </div>
                        <div className="flex gap-6 items-center">
                          <div className="w-24">
                            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">數量</label>
                            <input type="number" min="1" value={item.quantity} onChange={(e) => {
                                const updated = [...currentQuote.items];
                                updated[idx].quantity = parseInt(e.target.value) || 1;
                                updated[idx].subtotal = updated[idx].quantity * updated[idx].unitPrice;
                                setCurrentQuote({...currentQuote, items: updated});
                              }} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-center font-bold text-sm bg-slate-50 outline-none focus:bg-white focus:border-blue-400" />
                          </div>
                          <div className="w-32 text-right">
                             <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">小計</label>
                             <div className="font-bold text-slate-900 text-lg">{CURRENCIES[currentQuote.currency].symbol} {item.subtotal.toLocaleString()}</div>
                          </div>
                          <button onClick={() => setCurrentQuote({...currentQuote, items: currentQuote.items.filter((_, i) => i !== idx)})} className="p-2.5 mt-4 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={18}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 總計與備註 */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-12 pt-10 border-t border-slate-200">
                <div className="w-full md:max-w-md">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">報價特別備註 / 交易條款</label>
                   <textarea value={currentQuote.notes} onChange={(e) => setCurrentQuote({...currentQuote, notes: e.target.value})} className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition" placeholder="輸入需顯示於 PDF 的補充說明..."></textarea>
                </div>
                <div className="w-full md:w-80 space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <div className="flex justify-between text-slate-500 text-sm font-bold"><span>總金額小計</span><span>{CURRENCIES[currentQuote.currency].symbol} {totals.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                  <div className="flex justify-between text-slate-500 text-sm font-bold"><span>稅金 (5%)</span><span>{CURRENCIES[currentQuote.currency].symbol} {totals.tax.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                  <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                    <span className="font-bold text-lg">報價總計</span>
                    <span className="text-3xl font-black text-blue-600">{CURRENCIES[currentQuote.currency].symbol} {totals.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 動作按鈕 */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <button onClick={() => setShowPreview(true)} className="flex items-center gap-2 px-6 py-3 bg-slate-100 rounded-xl font-bold text-slate-700 hover:bg-slate-200 transition"><Eye size={18} /> 預覽版面</button>
              <div className="flex gap-4">
                <button onClick={() => setIsCreating(false)} className="px-6 py-3 font-bold text-slate-400 hover:text-slate-600">放棄編輯</button>
                <button onClick={saveAndDownload} className="flex items-center gap-2 px-10 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/30 hover:bg-emerald-700 hover:shadow-emerald-500/50 transition transform hover:-translate-y-0.5">
                  <Download size={18} /> 儲存資料庫並下載 PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 產品庫管理 (Admin) */}
        {activeTab === 'products' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map(p => (
              <div key={p.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-200 transition group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-10 opacity-50 transition group-hover:bg-blue-100"></div>
                <div className="flex justify-between items-start mb-4">
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-widest">{p.category}</span>
                  <div className="flex gap-2">
                    <button onClick={() => openModal('product', 'edit', p)} className="p-2 text-slate-400 hover:text-blue-600 transition bg-white border border-slate-100 shadow-sm rounded-lg"><Edit3 size={16}/></button>
                    <button onClick={() => handleDeleteItem('product', p.id)} className="p-2 text-slate-400 hover:text-red-500 transition bg-white border border-slate-100 shadow-sm rounded-lg"><Trash2 size={16}/></button>
                  </div>
                </div>
                <h4 className="font-black text-xl text-slate-800 mb-1">{p.sku}</h4>
                <p className="text-sm text-slate-600 mb-3 font-bold">{p.name}</p>
                <p className="text-xs text-slate-400 mb-6 h-8 overflow-hidden line-clamp-2 leading-relaxed">{p.spec}</p>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">標準定價</span>
                  <span className="font-black text-2xl text-blue-600">{CURRENCIES.CNY.symbol} {p.price.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 客戶管理 (Admin) */}
        {activeTab === 'customers' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-xs uppercase font-bold border-b border-slate-100 tracking-wider">
                <tr><th className="px-6 py-5">公司資料</th><th className="px-6 py-5">主要聯絡人</th><th className="px-6 py-5">合約等級 / 折扣</th><th className="px-6 py-5">地址</th><th className="px-6 py-5 text-right">操作</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition text-sm">
                    <td className="px-6 py-4 font-black text-slate-800">{c.name}</td>
                    <td className="px-6 py-4"><p className="font-bold text-slate-700">{c.contact}</p><p className="text-xs text-slate-400">{c.email}</p></td>
                    <td className="px-6 py-4"><span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold mr-2">{c.level}</span><span className="font-mono font-bold text-slate-500">{(c.discount * 100).toFixed(0)}%</span></td>
                    <td className="px-6 py-4 text-slate-500 text-xs font-medium">{c.address}</td>
                    <td className="px-6 py-4 flex justify-end gap-2">
                      <button onClick={() => openModal('customer', 'edit', c)} className="p-2 text-slate-400 hover:text-blue-600 transition bg-white border border-slate-200 shadow-sm rounded-lg"><Edit3 size={16} /></button>
                      <button onClick={() => handleDeleteItem('customer', c.id)} className="p-2 text-slate-400 hover:text-red-500 transition bg-white border border-slate-200 shadow-sm rounded-lg"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 使用者管理 (Admin) */}
        {activeTab === 'users' && currentUser.role === 'Admin' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-xs uppercase font-bold border-b border-slate-100 tracking-wider">
                <tr><th className="px-6 py-5">員工姓名 / 信箱</th><th className="px-6 py-5">登入帳號</th><th className="px-6 py-5">系統權限</th><th className="px-6 py-5">所屬單位與電話</th><th className="px-6 py-5 text-right">操作</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition text-sm">
                    <td className="px-6 py-4"><p className="font-black text-slate-800">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                    <td className="px-6 py-4 font-mono font-bold text-blue-600 bg-blue-50/30 rounded inline-block mt-3 px-2 py-1">{u.username}</td>
                    <td className="px-6 py-4"><span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${u.role === 'Admin' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>{u.role}</span></td>
                    <td className="px-6 py-4"><p className="font-bold text-slate-700">{u.company || '-'}</p><p className="text-xs text-slate-400">{u.contact || '-'}</p></td>
                    <td className="px-6 py-4 flex justify-end gap-2">
                      <button onClick={() => openModal('user', 'edit', u)} className="p-2 text-slate-400 hover:text-blue-600 transition bg-white border border-slate-200 shadow-sm rounded-lg"><Edit3 size={16} /></button>
                      <button onClick={() => handleDeleteItem('user', u.id)} className="p-2 text-slate-400 hover:text-red-500 transition bg-white border border-slate-200 shadow-sm rounded-lg"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* 真實 PDF 預覽與渲染視窗 (隱藏卷軸) */}
      {showPreview && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl h-[95vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 z-10">
               <h3 className="font-black text-lg text-slate-800 tracking-tight flex items-center gap-2"><Printer size={20} className="text-blue-600"/> 報價單 PDF 預覽與生成器</h3>
               <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-200 text-slate-500 rounded-full transition"><X size={24}/></button>
            </div>
            
            <div className="flex-grow bg-slate-300 p-8 overflow-y-auto flex justify-center">
               {/* A4 比例畫布 - html2canvas 將精準截取此 div */}
               <div id="pdf-preview-content" className="bg-white w-[210mm] min-h-[297mm] p-16 text-slate-900 shadow-2xl shrink-0" style={{boxSizing: 'border-box'}}>
                  {/* PDF Header */}
                  <div className="flex justify-between items-start border-b-4 border-slate-900 pb-10 mb-10">
                    <div>
                      <h1 className="text-5xl font-black italic tracking-tighter mb-4 text-slate-900">LUMENS</h1>
                      <p className="font-bold text-lg text-slate-700">Lumens Digital Optics Inc.</p>
                      <p className="text-sm text-slate-500">2F, No. 101, Gongdao 5th Rd., Section 2, Hsinchu City</p>
                    </div>
                    <div className="text-right">
                      <h2 className="text-5xl font-black text-slate-200 uppercase mb-6 tracking-widest">Quotation</h2>
                      <div className="space-y-1 font-bold text-sm text-slate-600">
                        <p>報價單號: <span className="font-mono text-slate-900">{currentQuote?.id}</span></p>
                        <p>開立日期: <span className="text-slate-900">{currentQuote?.createdAt}</span></p>
                        <p>專案承辦: <span className="text-slate-900">{currentQuote?.userName}</span></p>
                      </div>
                    </div>
                  </div>
                  
                  {/* PDF Client Info */}
                  <div className="mb-12">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 pb-2 mb-4">客戶資訊 (Bill To)</h3>
                    <p className="text-3xl font-black text-slate-800">{currentQuote?.customerName || '未指定客戶'}</p>
                  </div>

                  {/* PDF Table */}
                  <table className="w-full text-left mb-16 border-collapse">
                    <thead className="bg-slate-900 text-white">
                       <tr className="text-sm font-bold uppercase tracking-widest"><th className="p-4 rounded-tl-lg">產品型號 (SKU)</th><th className="p-4">產品說明 (Description)</th><th className="p-4 text-center">數量 (QTY)</th><th className="p-4 text-right rounded-tr-lg">小計 (Amount)</th></tr>
                    </thead>
                    <tbody className="divide-y-2 border-b-4 border-slate-900">
                      {currentQuote?.items.map((it, i) => (
                        <tr key={i} className="text-sm">
                           <td className="p-4 font-black text-slate-800">{it.sku}</td>
                           <td className="p-4 font-bold text-slate-600">{it.name}</td>
                           <td className="p-4 text-center font-bold">{it.quantity}</td>
                           <td className="p-4 text-right font-black text-slate-800">{CURRENCIES[currentQuote.currency].symbol} {it.subtotal.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* PDF Totals */}
                  <div className="flex justify-end mb-16">
                    <div className="w-80 space-y-4">
                      <div className="flex justify-between font-bold text-slate-600"><span>小計 (Subtotal)</span><span>{CURRENCIES[currentQuote?.currency || 'CNY'].symbol} {totals.subtotal.toLocaleString()}</span></div>
                      <div className="flex justify-between font-bold text-slate-600"><span>稅金 (Tax 5%)</span><span>{CURRENCIES[currentQuote?.currency || 'CNY'].symbol} {totals.tax.toLocaleString()}</span></div>
                      <div className="flex justify-between items-center pt-4 border-t-4 border-slate-900 font-black text-2xl">
                        <span>總計 (Total)</span>
                        <span className="text-slate-900">{CURRENCIES[currentQuote?.currency || 'CNY'].symbol} {totals.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* PDF Footer Notes */}
                  {currentQuote?.notes && (
                     <div className="border-t-2 border-slate-100 pt-8">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">條款與備註 (Terms & Notes)</h4>
                       <p className="text-sm font-bold text-slate-600 whitespace-pre-wrap">{currentQuote.notes}</p>
                     </div>
                  )}
               </div>
            </div>
            
            {/* Modal Bottom Actions (僅非自動下載時顯示) */}
            {!isGeneratingPDF && !isCreating && (
               <div className="p-6 bg-white border-t flex justify-end">
                  <button onClick={() => downloadAsPDF(currentQuote)} className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition">
                     <Download size={18} /> 單獨下載 PDF
                  </button>
               </div>
            )}
          </div>
        </div>
      )}

      {/* CRUD 共用編輯彈窗 */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-lg flex items-center gap-2 text-slate-800">
                {editModal.mode === 'add' ? '新增' : '編輯'}{editModal.type === 'product' ? '產品資料' : editModal.type === 'customer' ? '客戶資料' : '內部帳號'}
              </h3>
              <button onClick={() => setEditModal({ isOpen: false, type: '', mode: 'add', data: null })} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveItem} className="p-8 overflow-y-auto max-h-[70vh]">
              
              {/* Product Form */}
              {editModal.type === 'product' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">產品型號 (SKU)</label>
                      <input type="text" required value={editModal.data.sku} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, sku: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">產品系列</label>
                      <input type="text" required value={editModal.data.category} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, category: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如: VC攝像機" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">產品名稱</label>
                    <input type="text" required value={editModal.data.name} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, name: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">規格說明</label>
                    <textarea required value={editModal.data.spec} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, spec: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none focus:ring-2 focus:ring-blue-500 h-24" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">標準定價 (CNY)</label>
                    <input type="number" required min="0" value={editModal.data.price} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, price: parseFloat(e.target.value) || 0 } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-blue-600 text-lg outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              )}

              {/* Customer Form */}
              {editModal.type === 'customer' && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">公司 / 客戶名稱</label>
                    <input type="text" required value={editModal.data.name} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, name: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">聯絡人</label>
                      <input type="text" required value={editModal.data.contact} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, contact: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">電子信箱</label>
                      <input type="email" required value={editModal.data.email} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, email: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">合約等級</label>
                      <input type="text" required value={editModal.data.level} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, level: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="經銷商 A" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">折扣率 (1.0 = 原價)</label>
                      <input type="number" step="0.01" required min="0" max="1" value={editModal.data.discount} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, discount: parseFloat(e.target.value) || 1 } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-blue-600 outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">聯絡地址</label>
                    <input type="text" required value={editModal.data.address} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, address: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              )}

              {/* User Form */}
              {editModal.type === 'user' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">登入帳號 (ID)</label>
                      <input type="text" required value={editModal.data.username} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, username: e.target.value } })} disabled={editModal.mode === 'edit'} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">密碼設定</label>
                      <input type="password" required={editModal.mode === 'add'} placeholder={editModal.mode === 'edit' ? "修改請輸入新密碼" : ""} value={editModal.data.password} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, password: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">真實姓名</label>
                      <input type="text" required value={editModal.data.name} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, name: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">系統權限</label>
                      <select value={editModal.data.role} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, role: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                        <option value="User">一般使用者 (User)</option>
                        <option value="Admin">管理者 (Admin)</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">所屬單位 (公司)</label>
                    <input type="text" value={editModal.data.company} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, company: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">聯絡電話</label>
                      <input type="text" value={editModal.data.contact} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, contact: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">電子信箱</label>
                      <input type="email" value={editModal.data.email} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, email: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-10 flex justify-end gap-3">
                <button type="button" onClick={() => setEditModal({ isOpen: false, type: '', mode: 'add', data: null })} className="px-6 py-3 font-bold text-slate-500 hover:text-slate-700">取消</button>
                <button type="submit" className="px-10 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition">確認儲存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}