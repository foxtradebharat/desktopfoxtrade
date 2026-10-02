import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Upload, Link, Image } from 'lucide-react';
import NumberInput from './NumberInput';
import ModernDropdown from './ModernDropdown';
import ModernDatePicker from './ModernDatePicker';
import SetupDropdown from './SetupDropdown';
import EntryTypeDropdown from './EntryTypeDropdown';
import SymbolLogo from './SymbolLogo';
import BrokerLogo from './BrokerLogo';
import { BROKER_DEFINITIONS } from '../services/brokerLogos';
import { fetchStockPrice } from '../services/yahooService';
import { fetchStrikePrice } from '../services/strikePriceService';
import { searchStocks, getFallbackList } from '../services/stockService';
import { getCanonicalSymbol } from '../utils/securityMaster.js';

// Helper: today's date in DD-MM-YYYY format (IST)
function getTodayIST() {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'Asia/Kolkata'
  }).replace(/\//g, '-');
}

export default function AddTradeModal({ 
  isOpen, 
  onClose, 
  onSaveTrade, 
  initialData = null, 
  isEdit = false,
  tradingMarket = 'india'
}) {
  const [activeTab, setActiveTab] = useState('basic');
  const [stockSuggestions, setStockSuggestions] = useState(() => getFallbackList(tradingMarket));
  
  // Basic Info state
  const [stockName, setStockName] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [showStockDropdown, setShowStockDropdown] = useState(false);

  // Live multi-tier search when searchFilter or tradingMarket changes
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const results = await searchStocks(searchFilter, tradingMarket, 20);
        if (isMounted) setStockSuggestions(results);
      } catch {
        if (isMounted) setStockSuggestions(getFallbackList(tradingMarket));
      }
    }, 40);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchFilter, tradingMarket, isOpen]);
  
  const [side, setSide] = useState('Buy');
  const [status, setStatus] = useState('Open');
  const [cmp, setCmp] = useState('');
  const [trailingSl, setTrailingSl] = useState('');
  const [isFetchingCmp, setIsFetchingCmp] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Broker picker state — persists last used broker
  const [broker, setBroker] = useState(() => localStorage.getItem('foxtrade_last_broker') || 'not_defined');
  const [brokerPickerOpen, setBrokerPickerOpen] = useState(false);

  // Animated close handler â€” plays exit animation then calls onClose
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };


  // Multiple Entry Legs
  const [entryLegs, setEntryLegs] = useState([
    { id: 'entry-1', date: getTodayIST(), price: '', qty: '', stopLoss: '' }
  ]);

  // Multiple Exit Legs
  const [exitLegs, setExitLegs] = useState([
    { id: 'exit-1', date: '', price: '', qty: '' }
  ]);

  // Misc Tab state
  const [setup, setSetup] = useState('');
  const [entryType, setEntryType] = useState('');
  const [exitTrigger, setExitTrigger] = useState('');
  const [growthAreas, setGrowthAreas] = useState('');
  const [planFollowed, setPlanFollowed] = useState('Yes/No');
  const [quickNote, setQuickNote] = useState('');

  // Charts Tab state
  const [beforeEntryType, setBeforeEntryType] = useState('upload');
  const [beforeEntryUrl, setBeforeEntryUrl] = useState('');
  const [afterExitType, setAfterExitType] = useState('upload');
  const [afterExitUrl, setAfterExitUrl] = useState('');

  // Populate form if in edit mode
  useEffect(() => {
    if (initialData) {
      setStockName(initialData.name || '');
      setSide(initialData.type || 'Buy');
      setStatus(initialData.status || 'Open');
      setCmp(initialData.cmp || '');
      setSetup(initialData.setup || '');
      setEntryType(initialData.entryType || '');
      setQuickNote(initialData.quickNote || '');
      setBroker(initialData.broker || 'not_defined');
      
      // Rebuild entry legs
      if (initialData.entryLegs && initialData.entryLegs.length > 0) {
        setEntryLegs(initialData.entryLegs);
      } else {
        const legs = [
          { id: 'entry-1', date: initialData.date || getTodayIST(), price: initialData.entry || '', qty: initialData.qty || '', stopLoss: initialData.sl || '' }
        ];
        if (initialData.p1Price || initialData.p1Qty || initialData.p1Sl) {
          legs.push({ id: 'entry-2', date: initialData.p1Date || getTodayIST(), price: initialData.p1Price || '', qty: initialData.p1Qty || '', stopLoss: initialData.p1Sl || '' });
        }
        if (initialData.p2Price || initialData.p2Qty || initialData.p2Sl) {
          legs.push({ id: 'entry-3', date: initialData.p2Date || getTodayIST(), price: initialData.p2Price || '', qty: initialData.p2Qty || '', stopLoss: initialData.p2Sl || '' });
        }
        if (initialData.p3Price || initialData.p3Qty || initialData.p3Sl) {
          legs.push({ id: 'entry-4', date: initialData.p3Date || getTodayIST(), price: initialData.p3Price || '', qty: initialData.p3Qty || '', stopLoss: initialData.p3Sl || '' });
        }
        if (initialData.p4Price || initialData.p4Qty || initialData.p4Sl) {
          legs.push({ id: 'entry-5', date: initialData.p4Date || getTodayIST(), price: initialData.p4Price || '', qty: initialData.p4Qty || '', stopLoss: initialData.p4Sl || '' });
        }
        setEntryLegs(legs);
      }

      // Rebuild exit legs
      if (initialData.exitLegs && initialData.exitLegs.length > 0) {
        setExitLegs(initialData.exitLegs);
      } else {
        const exits = [];
        if (initialData.e1Price || initialData.e1Qty || initialData.e1Date) {
          exits.push({ id: 'exit-1', date: initialData.e1Date || '', price: initialData.e1Price || '', qty: initialData.e1Qty || '' });
        }
        if (initialData.e2Price || initialData.e2Qty || initialData.e2Date) {
          exits.push({ id: 'exit-2', date: initialData.e2Date || '', price: initialData.e2Price || '', qty: initialData.e2Qty || '' });
        }
        if (initialData.e3Price || initialData.e3Qty || initialData.e3Date) {
          exits.push({ id: 'exit-3', date: initialData.e3Date || '', price: initialData.e3Price || '', qty: initialData.e3Qty || '' });
        }
        if (initialData.e4Price || initialData.e4Qty || initialData.e4Date) {
          exits.push({ id: 'exit-4', date: initialData.e4Date || '', price: initialData.e4Price || '', qty: initialData.e4Qty || '' });
        }
        if (exits.length === 0) {
          exits.push({ id: 'exit-1', date: '', price: '', qty: '' });
        }
        setExitLegs(exits);
      }
    } else {
      setStockName('');
      setSide('Buy');
      setStatus('Open');
      setCmp('');
      setTrailingSl('');
      setEntryLegs([{ id: 'entry-1', date: getTodayIST(), price: '', qty: '', stopLoss: '' }]);
      setExitLegs([{ id: 'exit-1', date: '', price: '', qty: '' }]);
      setSetup('');
      setEntryType('');
      setExitTrigger('');
      setGrowthAreas('');
      setPlanFollowed('Yes/No');
      setQuickNote('');
      setBroker(localStorage.getItem('foxtrade_last_broker') || 'not_defined');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // Handlers for Entry Legs
  const handleAddEntryLeg = () => {
    if (entryLegs.length < 5) {
      setEntryLegs([
        ...entryLegs,
        { id: `entry-${Date.now()}`, date: getTodayIST(), price: '', qty: '', stopLoss: '' }
      ]);
    }
  };

  const handleUpdateEntryLeg = (id, field, value) => {
    setEntryLegs(entryLegs.map(leg => leg.id === id ? { ...leg, [field]: value } : leg));
  };

  const handleDeleteEntryLeg = (id) => {
    if (entryLegs.length > 1) {
      setEntryLegs(entryLegs.filter(leg => leg.id !== id));
    }
  };

  // Handlers for Exit Legs
  const handleAddExitLeg = () => {
    if (exitLegs.length < 4) {
      setExitLegs([
        ...exitLegs,
        { id: `exit-${Date.now()}`, date: '', price: '', qty: '' }
      ]);
    }
  };

  const handleUpdateExitLeg = (id, field, value) => {
    setExitLegs(exitLegs.map(leg => leg.id === id ? { ...leg, [field]: value } : leg));
  };

  const handleDeleteExitLeg = (id) => {
    if (exitLegs.length > 1) {
      setExitLegs(exitLegs.filter(leg => leg.id !== id));
    }
  };

  // Submit Handler
  const handleSubmit = (e) => {
    e.preventDefault();
    const canonicalName = getCanonicalSymbol(stockName) || 'STOCK';
    const tradeData = {
      name: canonicalName,
      type: side,
      status,
      cmp,
      trailingSl,
      setup,
      entryType,
      exitTrigger,
      growthAreas,
      planFollowed,
      quickNote,
      entryLegs,
      exitLegs,
      date: entryLegs[0]?.date || '20-07-2026',
      entry: parseFloat(entryLegs[0]?.price) || 0,
      qty: entryLegs[0]?.qty || 0,
      sl: parseFloat(entryLegs[0]?.stopLoss) || 0,
      p1Date: entryLegs[1]?.date || '',
      p1Price: entryLegs[1]?.price || '',
      p1Qty: entryLegs[1]?.qty || '',
      p1Sl: entryLegs[1]?.stopLoss || '',
      p2Date: entryLegs[2]?.date || '',
      p2Price: entryLegs[2]?.price || '',
      p2Qty: entryLegs[2]?.qty || '',
      p2Sl: entryLegs[2]?.stopLoss || '',
      p3Date: entryLegs[3]?.date || '',
      p3Price: entryLegs[3]?.price || '',
      p3Qty: entryLegs[3]?.qty || '',
      p3Sl: entryLegs[3]?.stopLoss || '',
      p4Date: entryLegs[4]?.date || '',
      p4Price: entryLegs[4]?.price || '',
      p4Qty: entryLegs[4]?.qty || '',
      p4Sl: entryLegs[4]?.stopLoss || '',
      e1Date: exitLegs[0]?.date || '',
      e1Price: exitLegs[0]?.price || '',
      e1Qty: exitLegs[0]?.qty || '',
      e2Date: exitLegs[1]?.date || '',
      e2Price: exitLegs[1]?.price || '',
      e2Qty: exitLegs[1]?.qty || '',
      e3Date: exitLegs[2]?.date || '',
      e3Price: exitLegs[2]?.price || '',
      e3Qty: exitLegs[2]?.qty || '',
      e4Date: exitLegs[3]?.date || '',
      e4Price: exitLegs[3]?.price || '',
      e4Qty: exitLegs[3]?.qty || '',
      broker: broker || 'not_defined',
    };
    if (broker && broker !== 'not_defined') {
      localStorage.setItem('foxtrade_last_broker', broker);
    }
    onSaveTrade(tradeData);
    handleClose();
  };

  return (
    <>
      {/* CSS keyframe animations */}
      <style>{`
        @keyframes atModalIn  { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
        @keyframes atModalOut { from { opacity:1; transform:scale(1);    } to { opacity:0; transform:scale(0.95); } }
        @keyframes atOverlayIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes atOverlayOut { from { opacity:1; } to { opacity:0; } }
        .at-scroll::-webkit-scrollbar { width:4px; }
        .at-scroll::-webkit-scrollbar-track { background:transparent; }
        .at-scroll::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.12); border-radius:4px; }
        .at-leg-row input:focus { outline:none; border-color:rgba(0,0,0,0.25) !important; }
      `}</style>

      {/* Overlay */}
      <div
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '16px',
          animation: isClosing ? 'atOverlayOut 0.18s ease forwards' : 'atOverlayIn 0.18s ease forwards'
        }}
      >
        {/* Modal card */}
        <div
          className="at-scroll"
          style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '24px',
            border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
            width: '100%', maxWidth: '820px', maxHeight: '88vh',
            overflowY: 'auto',
            boxShadow: 'var(--shadow-modal, 0 20px 25px -5px rgba(0,0,0,0.4), 0 8px 10px -6px rgba(0,0,0,0.2))',
            display: 'flex', flexDirection: 'column',
            animation: isClosing ? 'atModalOut 0.18s ease forwards' : 'atModalIn 0.2s ease forwards'
          }}
        >
          {/* ── HEADER ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '24px 28px 16px',
            borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.06))'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 300, color: 'var(--text-primary, #111827)', margin: 0 }}>
              {isEdit ? 'Edit Trade' : 'Add Trade'}
            </h2>
            <button onClick={handleClose} style={{ background:'none', border:'none', color:'var(--text-muted, #9ca3af)', cursor:'pointer', padding:'4px', display:'flex', borderRadius:'6px' }}>
              <X size={18} />
            </button>
          </div>

          {/* ── TABS + BROWSE CHARTS ── */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 28px', gap:'12px' }}>
            {/* Pill tabs */}
            <div style={{ display:'inline-flex', backgroundColor:'var(--bg-surface, rgba(0,0,0,0.05))', borderRadius:'9999px', padding:'3px', gap:'2px', border: '1px solid var(--border-color, transparent)' }}>
              {['basic','misc','charts'].map(tab => (
                <button
                  key={tab} type="button" onClick={() => setActiveTab(tab)}
                  style={{
                    padding:'6px 16px', borderRadius:'9999px', border:'none',
                    fontSize:'13px', fontWeight:500, cursor:'pointer',
                    transition:'all 0.2s ease', textTransform:'capitalize', whiteSpace:'nowrap',
                    backgroundColor: activeTab === tab ? 'var(--bg-card, #ffffff)' : 'transparent',
                    color: activeTab === tab ? 'var(--text-primary, #111827)' : 'var(--text-muted, #6b7280)',
                    boxShadow: activeTab === tab ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => alert('Charts gallery coming soon')} style={{ background:'none', border:'none', color:'var(--text-muted, #9ca3af)', fontSize:'12px', cursor:'pointer', fontWeight:500 }}>
              Browse Charts
            </button>
          </div>

          {/* ── KPI SUMMARY PILLS ── */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', padding:'0 28px 16px', borderBottom:'1px solid var(--border-color, rgba(0,0,0,0.05))' }}>
            {[
              { label:'Avg Entry', value:'₹0' }, { label:'Position', value:'₹0' },
              { label:'Allocation', value:'0%' }, { label:'Open Qty', value:'0' },
              { label:'Exited', value:'0' }, { label:'Avg Exit', value:'₹0' },
              { label:'Move', value:'0%' }, { label:'SL %', value:'0%' },
              { label:'R:R', value:'0x' }, { label:'P/L', value:'₹0' }
            ].map(({ label, value }) => (
              <div key={label} style={{ backgroundColor:'var(--bg-surface, rgba(0,0,0,0.035))', border:'1px solid var(--border-color, transparent)', borderRadius:'10px', padding:'8px 12px', minWidth:'74px' }}>
                <div style={{ fontSize:'10px', color:'var(--text-muted, #9ca3af)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
                <div style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary, #111827)', marginTop:'2px' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* â”€â”€ FORM â”€â”€ */}
          <form onSubmit={handleSubmit} style={{ padding:'20px 28px 28px', flex:1 }}>

            {/* â•â•â•â• TAB 1: BASIC â•â•â•â• */}
            {activeTab === 'basic' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

                {/* TRADE INFO card */}
                <div style={{ backgroundColor:'var(--bg-surface, rgba(0,0,0,0.02))', border:'1px solid var(--border-color, rgba(0,0,0,0.06))', borderRadius:'16px', padding:'16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
                    <span style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted, rgba(17,24,39,0.6))', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>Trade Info</span>
                    <div style={{ flex:1, height:'1px', backgroundColor:'var(--border-color, rgba(0,0,0,0.08))' }} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', gap:'12px', position:'relative' }}>
                    {/* Stock Name */}
                    <div style={{ position:'relative' }}>
                      <label style={{ display:'block', fontSize:'11px', fontWeight:500, color:'var(--text-muted, #9ca3af)', marginBottom:'6px' }}>Stock Name</label>
                      <input
                        type="text" placeholder="Type a stock name" value={stockName}
                        onChange={(e) => { setStockName(e.target.value); setSearchFilter(e.target.value); setShowStockDropdown(true); }}
                        onFocus={() => setShowStockDropdown(true)}
                        onBlur={async () => {
                          if ((!cmp || Number(cmp) === 0) && stockName.trim()) {
                            setIsFetchingCmp(true);
                            try {
                              const canonical = getCanonicalSymbol(stockName.trim());
                              let price = null;
                              const yData = await fetchStockPrice(canonical);
                              if (yData?.price || yData?.cmp) price = parseFloat(yData.cmp || yData.price);
                              else {
                                const strikeData = await fetchStrikePrice(canonical);
                                if (strikeData?.price) price = strikeData.price;
                              }
                              if (price && !isNaN(price)) setCmp(price.toFixed(2));
                            } catch {}
                            finally { setIsFetchingCmp(false); }
                          }
                        }}
                        style={{ width:'100%', padding:'8px 12px', borderRadius:'10px', border:'1px solid var(--border-color, rgba(0,0,0,0.1))', fontSize:'13px', outline:'none', boxSizing:'border-box', backgroundColor:'var(--bg-card, #fff)', color:'var(--text-primary, #111827)' }}
                      />
                      {showStockDropdown && searchFilter && (
                        <div style={{ position:'absolute', top:'100%', left:0, right:0, backgroundColor:'var(--bg-card, #fff)', border:'1px solid var(--border-color, rgba(0,0,0,0.1))', borderRadius:'12px', boxShadow:'0 15px 30px -5px rgba(0,0,0,0.3)', zIndex:100, maxHeight:'220px', overflowY:'auto', marginTop:'4px', padding:'4px 0' }}>
                          {stockSuggestions.map((stock) => (
                            <div key={`${stock.symbol}-${stock.exchange}`}
                              onClick={async () => {
                                const canonical = getCanonicalSymbol(stock.symbol);
                                setStockName(canonical); setShowStockDropdown(false); setIsFetchingCmp(true);
                                try {
                                  let price = null;
                                  const yData = await fetchStockPrice(canonical);
                                  if (yData?.price || yData?.cmp) price = parseFloat(yData.cmp || yData.price);
                                  else {
                                    const strikeData = await fetchStrikePrice(canonical);
                                    if (strikeData?.price) price = strikeData.price;
                                  }
                                  if (price && !isNaN(price)) setCmp(price.toFixed(2));
                                } catch {}
                                finally { setIsFetchingCmp(false); }
                              }}
                              style={{ padding:'8px 12px', cursor:'pointer', fontSize:'12px', borderBottom:'1px solid var(--border-color, #f9fafb)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor='var(--bg-hover, #f8faff)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor='transparent'}
                            >
                              <div style={{ display:'flex', alignItems:'center', gap:'8px', overflow:'hidden' }}>
                                <SymbolLogo symbol={stock.symbol} companyName={stock.name} size={20} />
                                <div style={{ overflow:'hidden' }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                                    <div style={{ fontWeight:700, color:'var(--text-primary, #111827)', fontFamily:'monospace', fontSize:'13px' }}>{stock.symbol}</div>
                                    {stock.alias && (
                                      <span style={{
                                        fontSize: '9px',
                                        fontWeight: 600,
                                        padding: '1.5px 6px',
                                        borderRadius: '4px',
                                        backgroundColor: 'var(--bg-hover, #f3f4f6)',
                                        color: 'var(--text-primary, #111827)',
                                        border: '1px solid var(--border-color, #e5e7eb)',
                                        letterSpacing: '0.25px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        lineHeight: 1.2
                                      }}>
                                        <span style={{ opacity: 0.75 }}>Formerly</span>
                                        <span style={{ fontWeight: 700 }}>{stock.alias}</span>
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize:'11px', color:'var(--text-muted, #6b7280)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{stock.name}</div>
                                </div>
                              </div>
                              <span style={{ fontSize:'10px', fontWeight:700, padding:'2px 6px', borderRadius:'4px', backgroundColor: stock.exchange === 'BSE' ? '#fef3c7' : (stock.exchange === 'NASDAQ' ? '#e0f2fe' : '#ecfdf5'), color: stock.exchange === 'BSE' ? '#92400e' : (stock.exchange === 'NASDAQ' ? '#0369a1' : '#065f46') }}>
                                {stock.exchange || 'NSE'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Side */}
                    <div>
                      <label style={{ display:'block', fontSize:'11px', fontWeight:500, color:'var(--text-muted, #9ca3af)', marginBottom:'6px' }}>Side</label>
                      <ModernDropdown value={side} options={[{ value:'Buy', label:'Buy' }, { value:'Sell', label:'Sell' }]} variant="form" onChange={(val) => setSide(val)} />
                    </div>
                    {/* Status */}
                    <div>
                      <label style={{ display:'block', fontSize:'11px', fontWeight:500, color:'var(--text-muted, #9ca3af)', marginBottom:'6px' }}>Status</label>
                      <ModernDropdown value={status} options={[{ value:'Open', label:'Open' }, { value:'Closed', label:'Closed' }]} variant="form" onChange={(val) => setStatus(val)} />
                    </div>
                    {/* CMP */}
                    <div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                        <label style={{ fontSize:'11px', fontWeight:500, color:'var(--text-muted, #9ca3af)' }}>CMP (₹)</label>
                        {isFetchingCmp && <span style={{ fontSize:'10px', color:'#f59e0b', fontWeight:600 }}>Fetching…</span>}
                      </div>
                      <NumberInput placeholder="0" value={cmp} onChange={(val) => setCmp(val)} />
                    </div>
                    {/* Trailing SL */}
                    <div>
                      <label style={{ display:'block', fontSize:'11px', fontWeight:500, color:'var(--text-muted, #9ca3af)', marginBottom:'6px' }}>Trailing SL (₹)</label>
                      <NumberInput placeholder="0" value={trailingSl} onChange={(val) => setTrailingSl(val)} />
                    </div>
                  </div>
                </div>

                {/* BROKER PICKER ─────────────────────────────────────────── */}
                {(() => {
                  const BROKERS = BROKER_DEFINITIONS.filter(b => b.id !== 'not_defined');
                  const selected = BROKERS.find(b => b.id === broker);

                  return (
                    <div style={{ position: 'relative' }}>
                      <label style={{ display:'block', fontSize:'11px', fontWeight:500, color:'var(--text-muted, #9ca3af)', marginBottom:'6px' }}>
                        Broker <span style={{ fontWeight:400, color:'var(--text-muted, #d1d5db)' }}>(optional — needed for Net P&L charges)</span>
                      </label>

                      {/* Trigger button */}
                      <button
                        type="button"
                        onClick={() => setBrokerPickerOpen(o => !o)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '8px',
                          padding: '7px 14px', borderRadius: '10px', cursor: 'pointer',
                          border: selected ? '1.5px solid var(--border-color, rgba(0,0,0,0.15))' : '1px solid var(--border-color, rgba(0,0,0,0.1))',
                          backgroundColor: selected ? 'var(--bg-hover, rgba(0,0,0,0.04))' : 'var(--bg-surface, rgba(0,0,0,0.02))',
                          transition: 'all 0.15s ease', fontSize: '13px', fontWeight: 600,
                          color: selected ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)',
                        }}
                      >
                        {selected ? (
                          <>
                            <BrokerLogo broker={selected.id} size={16} />
                            <span>{selected.label}</span>
                          </>
                        ) : (
                          <>
                            <BrokerLogo broker="not_defined" size={16} />
                            <span>Not Defined</span>
                          </>
                        )}
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ marginLeft: '2px', opacity: 0.5 }}>
                          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>

                      {/* Broker dropdown panel */}
                      {brokerPickerOpen && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, zIndex: 200,
                          marginTop: '6px', backgroundColor: 'var(--bg-card, #ffffff)',
                          border: '1px solid var(--border-color, rgba(0,0,0,0.1))', borderRadius: '14px',
                          boxShadow: '0 12px 28px -5px rgba(0,0,0,0.3)', padding: '6px',
                          minWidth: '220px', maxHeight: '280px', overflowY: 'auto'
                        }}>
                          {/* Not Defined option */}
                          <div
                            onClick={() => { setBroker('not_defined'); setBrokerPickerOpen(false); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '9px 12px', borderRadius: '9px', cursor: 'pointer',
                              backgroundColor: broker === 'not_defined' ? 'var(--bg-hover, rgba(0,0,0,0.06))' : 'transparent',
                              transition: 'background 0.12s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(0,0,0,0.04))'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = broker === 'not_defined' ? 'var(--bg-hover, rgba(0,0,0,0.06))' : 'transparent'}
                          >
                            <BrokerLogo broker="not_defined" size={16} />
                            <span style={{ fontSize:'13px', fontWeight:500, color:'var(--text-muted, #9ca3af)' }}>Not Defined</span>
                            {broker === 'not_defined' && <span style={{ marginLeft:'auto', fontSize:'12px', color:'var(--text-primary, #111827)', fontWeight: 700 }}>✓</span>}
                          </div>

                          <div style={{ height:'1px', backgroundColor:'var(--border-color, rgba(0,0,0,0.06))', margin:'4px 6px' }} />

                          {BROKERS.map(b => (
                            <div
                              key={b.id}
                              onClick={() => { setBroker(b.id); setBrokerPickerOpen(false); }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '9px 12px', borderRadius: '9px', cursor: 'pointer',
                                backgroundColor: broker === b.id ? 'var(--bg-hover, rgba(0,0,0,0.06))' : 'transparent',
                                transition: 'background 0.12s ease'
                              }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(0,0,0,0.04))'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = broker === b.id ? 'var(--bg-hover, rgba(0,0,0,0.06))' : 'transparent'}
                            >
                              <BrokerLogo broker={b.id} size={18} />
                              <span style={{ fontSize:'13px', fontWeight:600, color: 'var(--text-primary, #111827)' }}>{b.label}</span>
                              {broker === b.id && <span style={{ marginLeft:'auto', fontSize:'12px', color: 'var(--text-primary, #111827)', fontWeight: 700 }}>✓</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ENTRY LEGS */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                    <span style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted, rgba(17,24,39,0.6))', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>Entry Legs</span>
                    <div style={{ flex:1, height:'1px', backgroundColor:'var(--border-color, rgba(0,0,0,0.08))' }} />
                  </div>
                  {/* Column headers */}
                  <div style={{ display:'grid', gridTemplateColumns:'1.8fr 1fr 1fr 1fr 32px', gap:'8px', marginBottom:'6px', padding:'0 2px' }}>
                    {['Date / Time', 'Price (₹)', 'Qty', 'Stop Loss (₹)', ''].map((h, i) => (
                      <span key={i} style={{ fontSize:'11px', color:'var(--text-muted, #9ca3af)', fontWeight:500 }}>{h}</span>
                    ))}
                  </div>
                  <div className="at-leg-row" style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    {entryLegs.map((leg) => (
                      <div key={leg.id} style={{ display:'grid', gridTemplateColumns:'1.8fr 1fr 1fr 1fr 32px', gap:'8px', alignItems:'center' }}>
                        <ModernDatePicker value={leg.date} placeholder="dd-mm-yyyy" onChange={(val) => handleUpdateEntryLeg(leg.id,'date',val)} width="100%" variant="form" />
                        <NumberInput placeholder="0.00" value={leg.price} onChange={(val) => handleUpdateEntryLeg(leg.id,'price',val)} />
                        <NumberInput placeholder="0" value={leg.qty} onChange={(val) => handleUpdateEntryLeg(leg.id,'qty',val)} />
                        <NumberInput placeholder="0.00" value={leg.stopLoss} onChange={(val) => handleUpdateEntryLeg(leg.id,'stopLoss',val)} />
                        <button type="button" onClick={() => handleDeleteEntryLeg(leg.id)} disabled={entryLegs.length <= 1}
                          style={{ background:'none', border:'none', color:'var(--text-muted, #d1d5db)', cursor: entryLegs.length > 1 ? 'pointer' : 'default', padding:'4px', display:'flex', alignItems:'center' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {entryLegs.length < 5 && (
                      <button type="button" onClick={handleAddEntryLeg}
                        style={{ display:'flex', alignItems:'center', gap:'6px', padding:'7px 14px', borderRadius:'8px', border:'1px dashed var(--border-color, rgba(0,0,0,0.15))', backgroundColor:'transparent', color:'var(--text-muted, #6b7280)', fontSize:'12px', fontWeight:500, cursor:'pointer', width:'fit-content', marginTop:'4px' }}>
                        <Plus size={13} /> <span>Add Entry Leg</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* EXIT LEGS */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                    <span style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted, rgba(17,24,39,0.6))', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>Exit Legs</span>
                    <div style={{ flex:1, height:'1px', backgroundColor:'var(--border-color, rgba(0,0,0,0.08))' }} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1.8fr 1fr 1fr 32px', gap:'8px', marginBottom:'6px', padding:'0 2px' }}>
                    {['Date / Time', 'Price (₹)', 'Qty', ''].map((h, i) => (
                      <span key={i} style={{ fontSize:'11px', color:'var(--text-muted, #9ca3af)', fontWeight:500 }}>{h}</span>
                    ))}
                  </div>
                  <div className="at-leg-row" style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    {exitLegs.map((leg) => (
                      <div key={leg.id} style={{ display:'grid', gridTemplateColumns:'1.8fr 1fr 1fr 32px', gap:'8px', alignItems:'center' }}>
                        <ModernDatePicker value={leg.date} placeholder="dd-mm-yyyy" onChange={(val) => handleUpdateExitLeg(leg.id,'date',val)} width="100%" variant="form" />
                        <NumberInput placeholder="0.00" value={leg.price} onChange={(val) => handleUpdateExitLeg(leg.id,'price',val)} />
                        <NumberInput placeholder="0" value={leg.qty} onChange={(val) => handleUpdateExitLeg(leg.id,'qty',val)} />
                        <button type="button" onClick={() => handleDeleteExitLeg(leg.id)} disabled={exitLegs.length <= 1}
                          style={{ background:'none', border:'none', color:'var(--text-muted, #d1d5db)', cursor: exitLegs.length > 1 ? 'pointer' : 'default', padding:'4px', display:'flex', alignItems:'center' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {exitLegs.length < 4 && (
                      <button type="button" onClick={handleAddExitLeg}
                        style={{ display:'flex', alignItems:'center', gap:'6px', padding:'7px 14px', borderRadius:'8px', border:'1px dashed var(--border-color, rgba(0,0,0,0.15))', backgroundColor:'transparent', color:'var(--text-muted, #6b7280)', fontSize:'12px', fontWeight:500, cursor:'pointer', width:'fit-content', marginTop:'4px' }}>
                        <Plus size={13} /> <span>Add Exit Leg</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* STAGGERED TSL GROUPING */}
                <div style={{ backgroundColor:'var(--bg-surface, rgba(0,0,0,0.02))', border:'1px solid var(--border-color, rgba(0,0,0,0.06))', borderRadius:'16px', padding:'16px' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted, rgba(17,24,39,0.6))', textTransform:'uppercase', letterSpacing:'0.06em' }}>Staggered TSL Grouping</div>
                      <div style={{ fontSize:'11px', color:'var(--text-muted, #9ca3af)', marginTop:'4px', fontWeight:400 }}>Set a different TSL for selected quantity. Any unassigned quantity keeps the Main TSL.</div>
                    </div>
                    <button type="button" style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 12px', borderRadius:'8px', border:'1px solid var(--border-color, rgba(0,0,0,0.1))', backgroundColor:'transparent', color:'var(--text-secondary, #6b7280)', fontSize:'12px', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                      <Plus size={13} /> Add TSL group
                    </button>
                  </div>
                  <div style={{ textAlign:'center', padding:'18px 0 4px', color:'var(--text-muted, #9ca3af)' }}>
                    <div style={{ fontSize:'20px', fontWeight:300, marginBottom:'4px' }}>0</div>
                    <div style={{ fontSize:'12px', fontWeight:500 }}>No entry quantity available</div>
                    <div style={{ fontSize:'11px', marginTop:'2px' }}>Add an open entry leg above to assign a TSL group.</div>
                  </div>
                </div>

              </div>
            )}

            {/* ════ TAB 2: MISC ════ */}
            {activeTab === 'misc' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                <div style={{ backgroundColor:'var(--bg-surface, rgba(0,0,0,0.02))', border:'1px solid var(--border-color, rgba(0,0,0,0.06))', borderRadius:'16px', padding:'16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
                    <span style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted, rgba(17,24,39,0.6))', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>Trade Details</span>
                    <div style={{ flex:1, height:'1px', backgroundColor:'var(--border-color, rgba(0,0,0,0.08))' }} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'12px' }}>
                    <div>
                      <label style={{ display:'block', fontSize:'11px', fontWeight:500, color:'var(--text-muted, #9ca3af)', marginBottom:'6px' }}>Setup</label>
                      <SetupDropdown value={setup} placeholder="Select Setup" variant="form" onChange={(val) => setSetup(val)} />
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:'11px', fontWeight:500, color:'var(--text-muted, #9ca3af)', marginBottom:'6px' }}>Entry Type</label>
                      <EntryTypeDropdown value={entryType} placeholder="Select Entry Type" variant="form" onChange={(val) => setEntryType(val)} />
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:'11px', fontWeight:500, color:'var(--text-muted, #9ca3af)', marginBottom:'6px' }}>Plan Followed</label>
                      <ModernDropdown value={planFollowed} options={[
                        { value:'Yes/No', label:'Yes/No' }, { value:'Yes', label:'Yes' }, { value:'No', label:'No' }
                      ]} variant="form" onChange={(val) => setPlanFollowed(val)} />
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:'11px', fontWeight:500, color:'var(--text-muted, #9ca3af)', marginBottom:'6px' }}>Exit Trigger</label>
                      <ModernDropdown value={exitTrigger} options={[
                        { value:'', label:'Select Exit Triggers' }, { value:'SL Hit', label:'SL Hit' },
                        { value:'Target Hit', label:'Target Hit' }, { value:'TSL Hit', label:'TSL Hit' },
                        { value:'Manual Exit', label:'Manual Exit' }
                      ]} variant="form" onChange={(val) => setExitTrigger(val)} />
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:'11px', fontWeight:500, color:'var(--text-muted, #9ca3af)', marginBottom:'6px' }}>Growth Areas</label>
                      <ModernDropdown value={growthAreas} options={[
                        { value:'', label:'Select Growth Areas' }, { value:'Position Sizing', label:'Position Sizing' },
                        { value:'Entry Timing', label:'Entry Timing' }, { value:'Exit Discipline', label:'Exit Discipline' },
                        { value:'Risk Management', label:'Risk Management' }
                      ]} variant="form" onChange={(val) => setGrowthAreas(val)} />
                    </div>
                  </div>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'11px', fontWeight:500, color:'var(--text-muted, #9ca3af)', marginBottom:'6px' }}>Quick Note</label>
                  <textarea rows={4} value={quickNote} onChange={(e) => setQuickNote(e.target.value)}
                    placeholder="Type your trading notes, post-trade analysis, or links here..."
                    style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'1px solid var(--border-color, rgba(0,0,0,0.1))', fontSize:'13px', outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit', color:'var(--text-primary, #111827)', backgroundColor:'var(--bg-card, #fff)' }} />
                </div>
              </div>
            )}

            {/* ════ TAB 3: CHARTS ════ */}
            {activeTab === 'charts' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'16px' }}>
                {[
                  { title:'Before Entry', type:beforeEntryType, setType:setBeforeEntryType, url:beforeEntryUrl, setUrl:setBeforeEntryUrl },
                  { title:'After Exit',   type:afterExitType,   setType:setAfterExitType,   url:afterExitUrl,   setUrl:setAfterExitUrl }
                ].map(({ title, type, setType, url, setUrl }) => (
                  <div key={title} style={{ backgroundColor:'var(--bg-surface, rgba(0,0,0,0.02))', border:'1px solid var(--border-color, rgba(0,0,0,0.06))', borderRadius:'16px', padding:'16px' }}>
                    <div style={{ fontSize:'12px', fontWeight:600, color:'var(--text-primary, #374151)', marginBottom:'12px' }}>{title}</div>
                    <div style={{ display:'flex', gap:'12px', marginBottom:'14px' }}>
                      <button type="button" onClick={() => setType('upload')} style={{ background:'none', border:'none', fontSize:'12px', fontWeight: type==='upload' ? 600 : 400, color: type==='upload' ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}>
                        <Upload size={13} /> Upload File
                      </button>
                      <button type="button" onClick={() => setType('url')} style={{ background:'none', border:'none', fontSize:'12px', fontWeight: type==='url' ? 600 : 400, color: type==='url' ? 'var(--text-primary, #111827)' : 'var(--text-muted, #9ca3af)', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}>
                        <Link size={13} /> TradingView URL
                      </button>
                    </div>
                    {type === 'upload' ? (
                      <div style={{ border:'2px dashed var(--border-color, rgba(0,0,0,0.12))', borderRadius:'10px', padding:'28px 20px', textAlign:'center', backgroundColor:'var(--bg-surface, rgba(0,0,0,0.01))', cursor:'pointer' }}>
                        <Image size={22} color="var(--text-muted, #d1d5db)" />
                        <div style={{ fontSize:'12px', fontWeight:500, color:'var(--text-secondary, #4b5563)', marginTop:'8px' }}>Drop image here or click to upload</div>
                        <div style={{ fontSize:'10px', color:'var(--text-muted, #9ca3af)', marginTop:'4px' }}>PNG, JPG, WEBP up to 5MB</div>
                      </div>
                    ) : (
                      <div>
                        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste TradingView URL..."
                          style={{ width:'100%', padding:'8px 12px', borderRadius:'10px', border:'1px solid var(--border-color, rgba(0,0,0,0.1))', fontSize:'12px', outline:'none', boxSizing:'border-box', backgroundColor:'var(--bg-card, #fff)', color:'var(--text-primary, #111827)' }} />
                        <button type="button" style={{ marginTop:'8px', padding:'6px 14px', borderRadius:'8px', backgroundColor:'var(--accent-orange, #f97316)', color:'#fff', fontSize:'12px', border:'none', cursor:'pointer', fontWeight: 600 }}>
                          Import Chart
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── BOTTOM ACTION BUTTONS ── */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'8px', marginTop:'24px', paddingTop:'16px', borderTop:'1px solid var(--border-color, rgba(0,0,0,0.06))' }}>
              <button type="button" onClick={handleClose}
                style={{ padding:'9px 20px', borderRadius:'10px', border:'1px solid var(--border-color, rgba(0,0,0,0.1))', backgroundColor:'var(--bg-surface, transparent)', fontSize:'13px', fontWeight:500, color:'var(--text-secondary, #374151)', cursor:'pointer' }}>
                Cancel
              </button>
              <button type="submit"
                style={{ padding:'9px 22px', borderRadius:'10px', border:'none', backgroundColor:'var(--text-primary, #111827)', fontSize:'13px', fontWeight:600, color:'var(--bg-primary, #ffffff)', cursor:'pointer' }}>
                {isEdit ? 'Save Changes' : 'Add Trade'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}
