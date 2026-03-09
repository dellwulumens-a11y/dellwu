import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Trash2, Download, Share2, Save, History, 
  Users, Package, FileText, ChevronRight, Search, 
  Settings, UserCircle, Globe, AlertCircle, Copy,
  CheckCircle2, Printer, Eye, LogOut, Edit3, UserPlus, X, Lock,
  ChevronDown
} from 'lucide-react';

// --- 初期資料：Lumens 產品清單 ---
const INITIAL_PRODUCTS = [
  { id: 'vc-001', sku: 'VC-A71P', name: '4K IP PTZ 攝像機', spec: '4K 60fps, 30x 光學變焦, HDMI/SDI/Ethernet', category: 'VC攝像機', price: 2500 },
  { id: 'vc-002', sku: 'VC-A51P', name: 'Full HD IP PTZ 攝像機', spec: '1080p 60fps, 20x 光學變焦, PoE+', category: 'VC攝像機', price: 1800 },
  { id: 'vc-003', sku: 'VC-TR40', name: 'AI 自動追蹤攝像機', spec: 'AI 智慧追蹤, 1080p, 20x 變焦, 雙鏡頭', category: 'VC攝像機', price: 2200 },
  { id: 'kb-001', sku: 'VS-KB30', name: 'IP 攝像機控制器', spec: '支援 VISCA/Pelco, LCD 顯示螢幕, 搖桿控制', category: 'KB控制器', price: 800 },
  { id: 'kb-002', sku: 'VS-K20', name: '精簡型攝影機控制器', spec: 'USB/RS-232 控制, 五向按鈕', category: 'KB控制器', price: 450 },
  { id: 'oip-001', sku: 'OIP-D50C', name: '1G 分散式編解碼器', spec: '4K 傳輸, 網路控制, 低延遲', category: 'OIP橋接器', price: 1200 },
  { id: 'oip-002', sku: 'OIP-N40', name: 'NDI|HX 轉接器', spec: 'HDMI 轉 NDI, PoE 供電', category: 'OIP橋接器', price: 950 },
];

const INITIAL_CUSTOMERS = [
  { id: 'c1', name: '台北影音整合有限公司', contact: '王大明', email: 'wang@example.com', level: '經銷商 A', discount: 0.7, address: '台北市信義區忠孝東路' },
  { id: 'c2', name: '雲端教育中心', contact: '李小姐', email: 'lee@edu.com', level: '一般客戶', discount: 1.0, address: '台中市西區台灣大道' },
];

const INITIAL_USERS = [
  { id: 'u1', username: 'admin', password: 'Lumens123', name: '系統管理員', role: 'Admin' },
  { id: 'u2', username: 'sales01', password: 'user123', name: '業務專員 A', role: 'User' },
];

const CURRENCIES = {
  CNY: { symbol: '¥', rate: 1, label: '人民幣' },
  USD: { symbol: '$', rate: 0.14, label: '美金' },
  EUR: { symbol: '€', rate: 0.13, label: '歐元' },
};

export default function App() {
  // --- 認證狀態 ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // --- 資料狀態 ---
  const [activeTab, setActiveTab] = useState('quotes');
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [users, setUsers] = useState(INITIAL_USERS);
  const [quotes, setQuotes] = useState([]);
  const [currency, setCurrency] = useState('CNY');
  
  // --- 編輯狀態 ---
  const [isCreating, setIsCreating] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // --- 產品連動選單狀態 ---
  const [tempSelection, setTempSelection] = useState({ category: '', sku: '', name: '' });

  // --- 登入邏輯 ---
  const handleLogin = (e) => {
    e.preventDefault();
    const user = users.find(u => u.username === loginForm.username && u.password === loginForm.password);
    if (user) {
      setIsLoggedIn(true);
      setCurrentUser(user);
      setLoginError('');
      setActiveTab('quotes');
    } else {
      setLoginError('帳號或密碼錯誤');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  // --- 報價單邏輯 ---
  const generateQuoteID = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const count = (quotes.length + 1).toString().padStart(3, '0');
    return `PO${dateStr}${count}`;
  };

  const startNewQuote = () => {
    const newQuote = {
      id: generateQuoteID(),
      version: 1,
      createdAt: new Date().toLocaleDateString(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      customerName: '',
      userName: '', // 開放手動輸入
      companyName: 'Lumens 科技',
      items: [],
      status: '草稿',
      currency: currency,
      taxRate: 0.05,
      notes: '',
      history: []
    };
    setCurrentQuote(newQuote);
    setIsCreating(true);
    setTempSelection({ category: '', sku: '', name: '' });
  };

  // 連動選擇產品系列
  const handleCategoryChange = (cat) => {
    setTempSelection({ category: cat, sku: '', name: '' });
  };

  // 連動選擇產品型號
  const handleSkuChange = (sku) => {
    const product = products.find(p => p.sku === sku);
    if (product) {
      setTempSelection({ ...tempSelection, sku: sku, name: product.name });
    }
  };

  // 確認加入產品
  const confirmAddItem = () => {
    if (!tempSelection.sku) return;
    const product = products.find(p => p.sku === tempSelection.sku);
    const newItem = { ...product, quantity: 1, unitPrice: product.price, subtotal: product.price };
    setCurrentQuote({ ...currentQuote, items: [...currentQuote.items, newItem] });
    // 重置選單
    setTempSelection({ category: '', sku: '', name: '' });
  };

  const calculateTotals = (quote) => {
    if (!quote) return { subtotal: 0, tax: 0, total: 0 };
    const subtotal = quote.items.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * quote.taxRate;
    return { subtotal, tax, total: subtotal + tax };
  };

  const totals = useMemo(() => calculateTotals(currentQuote), [currentQuote]);

  // 下載 PDF 邏輯
  const downloadAsPDF = (quote) => {
    // 這裡模擬 PDF 下載。在實際應用中，會呼叫後端 API 或使用 jsPDF。
    // 為了展示效果，我們建立一個包含報價單資訊的文字檔案並命名為 .pdf
    const content = `
      Lumens 報價單
      單號: ${quote.id}
      日期: ${quote.createdAt}
      製單人: ${quote.userName}
      客戶: ${quote.customerName}
      
      項目清單:
      ${quote.items.map(item => `- ${item.sku}: ${item.name} x ${item.quantity} = ${item.subtotal}`).join('\n')}
      
      總計: ${CURRENCIES[quote.currency].symbol} ${calculateTotals(quote).total.toLocaleString()}
    `;
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${quote.id}_v${quote.version}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const saveAndDownload = () => {
    if (!currentQuote.userName) {
      alert('請填寫製單人員姓名');
      return;
    }
    if (currentQuote.items.length === 0) {
      alert('請至少加入一個產品項目');
      return;
    }
    
    // 儲存至列表
    setQuotes([currentQuote, ...quotes]);
    
    // 執行下載
    downloadAsPDF(currentQuote);
    
    // 關閉編輯介面
    setIsCreating(false);
  };

  // --- UI 部分 ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-slate-900 p-8 text-white text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-3xl italic mx-auto mb-4">L</div>
            <h1 className="text-2xl font-bold tracking-tight">Lumens NPD 報價系統</h1>
          </div>
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            {loginError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2"><AlertCircle size={16} /> {loginError}</div>}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">帳號</label>
              <input type="text" required value={loginForm.username} onChange={(e) => setLoginForm({...loginForm, username: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="admin" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">密碼</label>
              <input type="password" required value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition transform active:scale-[0.98]">登入系統</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white p-6 flex flex-col shrink-0">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl italic">L</div>
          <div><h1 className="font-bold text-lg leading-tight">Lumens NPD</h1><p className="text-xs text-slate-400 font-mono">{currentUser.role} Mode</p></div>
        </div>
        <nav className="space-y-2 flex-grow">
          <button onClick={() => {setActiveTab('quotes'); setIsCreating(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeTab === 'quotes' ? 'bg-blue-600 shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800 text-slate-400'}`}><FileText size={20} /> 報價系統</button>
          {currentUser.role === 'Admin' && (
            <>
              <div className="px-4 pt-6 pb-2 text-[10px] uppercase font-bold text-slate-600 tracking-widest">後台管理</div>
              <button onClick={() => setActiveTab('products')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeTab === 'products' ? 'bg-slate-700' : 'hover:bg-slate-800 text-slate-400'}`}><Package size={20} /> 產品庫管理</button>
              <button onClick={() => setActiveTab('customers')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeTab === 'customers' ? 'bg-slate-700' : 'hover:bg-slate-800 text-slate-400'}`}><Users size={20} /> 客戶管理</button>
            </>
          )}
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">{currentUser.name.slice(0,1)}</div>
            <div className="text-xs"><p className="font-bold truncate w-20">{currentUser.name}</p></div>
          </div>
          <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 transition"><LogOut size={18} /></button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-8 overflow-y-auto max-h-screen">
        <header className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold">{isCreating ? '建立新報價單' : activeTab === 'quotes' ? '報價記錄' : activeTab === 'products' ? '產品資料' : '客戶資料'}</h2>
          {activeTab === 'quotes' && !isCreating && (
            <button onClick={startNewQuote} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md transition"><Plus size={18} /> 新增報價</button>
          )}
        </header>

        {/* 報價清單列表 */}
        {activeTab === 'quotes' && !isCreating && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b border-slate-200">
                <tr><th className="px-6 py-4">單號</th><th className="px-6 py-4">客戶</th><th className="px-6 py-4">製單人</th><th className="px-6 py-4">金額</th><th className="px-6 py-4">操作</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.length === 0 ? <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400">目前尚無報價單記錄</td></tr> : (
                  quotes.map(q => (
                    <tr key={q.id} className="hover:bg-slate-50 transition text-sm">
                      <td className="px-6 py-4 font-mono font-medium text-blue-600">{q.id}</td>
                      <td className="px-6 py-4 font-bold">{q.customerName || '未指定'}</td>
                      <td className="px-6 py-4 text-slate-600">{q.userName}</td>
                      <td className="px-6 py-4 font-bold">{CURRENCIES[q.currency].symbol} {calculateTotals(q).total.toLocaleString()}</td>
                      <td className="px-6 py-4 flex gap-2">
                        <button onClick={() => {setCurrentQuote(q); setIsCreating(true);}} className="text-slate-400 hover:text-blue-600" title="查看"><Eye size={18} /></button>
                        <button onClick={() => downloadAsPDF(q)} className="text-slate-400 hover:text-emerald-600" title="下載 PDF"><Download size={18} /></button>
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
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              {/* 基本資訊區塊 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 pb-10 border-b border-slate-100">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">報價單號</label>
                  <p className="text-xl font-mono font-bold text-blue-600">{currentQuote.id}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">製單人員 <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={currentQuote.userName} 
                    onChange={(e) => setCurrentQuote({...currentQuote, userName: e.target.value})}
                    placeholder="請輸入姓名"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">客戶名稱</label>
                  <select 
                    value={currentQuote.customerName}
                    onChange={(e) => setCurrentQuote({...currentQuote, customerName: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">請選擇客戶...</option>
                    {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* 產品新增控制區 (獨立按鈕與連動選單) */}
              <div className="mb-10 bg-slate-50 p-6 rounded-2xl border border-slate-200 border-dashed">
                <h4 className="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2"><Package size={16} /> 產品快速新增器</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">1. 產品系列</label>
                    <select 
                      value={tempSelection.category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm shadow-sm"
                    >
                      <option value="">選擇系列...</option>
                      {[...new Set(products.map(p => p.category))].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">2. 產品型號 (SKU)</label>
                    <select 
                      value={tempSelection.sku}
                      disabled={!tempSelection.category}
                      onChange={(e) => handleSkuChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm shadow-sm disabled:opacity-50"
                    >
                      <option value="">選擇型號...</option>
                      {products.filter(p => p.category === tempSelection.category).map(p => <option key={p.id} value={p.sku}>{p.sku}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">系統自動帶入品名</label>
                    <input 
                      type="text" 
                      readOnly 
                      value={tempSelection.name}
                      placeholder="自動顯示..."
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 italic" 
                    />
                  </div>
                  <button 
                    onClick={confirmAddItem}
                    disabled={!tempSelection.sku}
                    className="flex items-center justify-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-black transition disabled:bg-slate-300 shadow-sm"
                  >
                    <Plus size={18} /> 確認加入項目
                  </button>
                </div>
              </div>

              {/* 報價清單展示 */}
              <div className="space-y-3 mb-10">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">目前的報價清單</h4>
                {currentQuote.items.length === 0 ? (
                  <div className="py-16 text-center text-slate-300 border border-slate-100 rounded-xl bg-slate-50/50 italic">尚未加入任何產品</div>
                ) : (
                  <div className="space-y-3">
                    {currentQuote.items.map((item, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex-grow">
                          <p className="font-bold text-blue-700">{item.sku}</p>
                          <p className="text-xs font-medium text-slate-600">{item.name}</p>
                        </div>
                        <div className="flex gap-4 items-center">
                          <div className="w-20">
                            <input 
                              type="number" min="1" 
                              value={item.quantity} 
                              onChange={(e) => {
                                const updated = [...currentQuote.items];
                                updated[idx].quantity = parseInt(e.target.value) || 1;
                                updated[idx].subtotal = updated[idx].quantity * updated[idx].unitPrice;
                                setCurrentQuote({...currentQuote, items: updated});
                              }}
                              className="w-full px-2 py-1 border rounded text-center font-bold text-sm" 
                            />
                          </div>
                          <div className="w-28 text-right font-bold text-slate-900">
                            {CURRENCIES[currentQuote.currency].symbol} {item.subtotal.toLocaleString()}
                          </div>
                          <button onClick={() => setCurrentQuote({...currentQuote, items: currentQuote.items.filter((_, i) => i !== idx)})} className="p-2 text-slate-300 hover:text-red-500 transition"><Trash2 size={18}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 結帳資訊 */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-10 pt-8 border-t border-slate-100">
                <div className="w-full md:max-w-md">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">報價備註</label>
                   <textarea value={currentQuote.notes} onChange={(e) => setCurrentQuote({...currentQuote, notes: e.target.value})} className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="輸入此報價單的特別說明..."></textarea>
                </div>
                <div className="w-full md:w-80 space-y-3">
                  <div className="flex justify-between text-slate-500 text-sm font-medium"><span>小計</span><span>{CURRENCIES[currentQuote.currency].symbol} {totals.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                  <div className="flex justify-between text-slate-500 text-sm font-medium"><span>稅金 (5%)</span><span>{CURRENCIES[currentQuote.currency].symbol} {totals.tax.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                  <div className="flex justify-between items-center pt-3 border-t-2 border-slate-900">
                    <span className="font-bold text-lg">總額</span>
                    <span className="text-3xl font-black text-blue-600">{CURRENCIES[currentQuote.currency].symbol} {totals.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 功能按鈕區 */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <button onClick={() => setShowPreview(true)} className="flex items-center gap-2 px-6 py-2 bg-slate-100 rounded-xl font-bold text-slate-700 hover:bg-slate-200 transition"><Eye size={18} /> 預覽 PDF</button>
              <div className="flex gap-4">
                <button onClick={() => setIsCreating(false)} className="px-6 py-2 font-bold text-slate-400 hover:text-slate-600">取消編輯</button>
                <button 
                  onClick={saveAndDownload} 
                  className="flex items-center gap-2 px-10 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition"
                >
                  <Download size={18} /> 儲存並下載
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 預留空間給產品庫/客戶管理 (Admin 功能) */}
        {activeTab === 'products' && (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
            <Package size={48} className="mx-auto text-slate-200 mb-4" />
            <h3 className="text-xl font-bold text-slate-400">產品庫管理模組</h3>
            <p className="text-slate-400">管理員可在這裡新增或刪除基準產品資料</p>
          </div>
        )}
      </main>

      {/* PDF 預覽 Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
             <div className="p-6 border-b flex justify-between items-center bg-slate-50">
               <h3 className="font-bold text-lg tracking-tight">Lumens 報價單預覽模式</h3>
               <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={24}/></button>
             </div>
             <div className="flex-grow bg-slate-200 p-8 overflow-y-auto">
               {/* 模擬 A4 頁面 */}
               <div className="bg-white w-[210mm] min-h-[297mm] mx-auto p-16 text-slate-900 shadow-2xl shadow-black/20">
                  <div className="flex justify-between items-start border-b-4 border-slate-900 pb-10 mb-10">
                    <div>
                      <h1 className="text-4xl font-black italic tracking-tighter mb-4">LUMENS</h1>
                      <p className="font-bold text-lg">Lumens Digital Optics Inc.</p>
                      <p className="text-sm">2F, No. 101, Gongdao 5th Rd., Section 2, Hsinchu City</p>
                    </div>
                    <div className="text-right">
                      <h2 className="text-5xl font-bold text-slate-100 uppercase mb-4">Quotation</h2>
                      <div className="space-y-1 font-medium text-sm">
                        <p>單號: <span className="font-mono">{currentQuote.id}</span></p>
                        <p>日期: {currentQuote.createdAt}</p>
                        <p>製單人: {currentQuote.userName}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-10">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b mb-3">客戶資訊 (Bill To)</h3>
                    <p className="text-2xl font-bold">{currentQuote.customerName || '未指定客戶'}</p>
                  </div>

                  <table className="w-full text-left mb-16">
                    <thead className="bg-slate-900 text-white"><tr className="text-sm"><th className="p-4">產品型號</th><th className="p-4">產品說明</th><th className="p-4 text-center">數量</th><th className="p-4 text-right">金額</th></tr></thead>
                    <tbody className="divide-y border-b-2 border-slate-900">
                      {currentQuote.items.map((it, i) => (
                        <tr key={i} className="text-sm"><td className="p-4 font-bold">{it.sku}</td><td className="p-4 text-slate-500">{it.name}</td><td className="p-4 text-center">{it.quantity}</td><td className="p-4 text-right font-bold">{CURRENCIES[currentQuote.currency].symbol} {it.subtotal.toLocaleString()}</td></tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-end">
                    <div className="w-64 space-y-3">
                      <div className="flex justify-between"><span>小計 (Subtotal)</span><span>{CURRENCIES[currentQuote.currency].symbol} {totals.subtotal.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>稅金 (Tax 5%)</span><span>{CURRENCIES[currentQuote.currency].symbol} {totals.tax.toLocaleString()}</span></div>
                      <div className="flex justify-between items-center pt-4 border-t-4 border-slate-900 font-bold text-xl">
                        <span>總計 (Total)</span>
                        <span className="text-blue-600">{CURRENCIES[currentQuote.currency].symbol} {totals.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}