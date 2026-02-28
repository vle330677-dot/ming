import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, X, Gem, Music, 
  Landmark, ShoppingBag, 
  Crown, Home, TrendingUp, ShieldAlert
} from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

const buildings = [
  { id: 'city_hall', name: '东部市局', x: 50, y: 35, icon: <Landmark/>, desc: '权力巅峰与市长繁荣度管理。' },
  { id: 'estate', name: '贵族庄园', x: 25, y: 25, icon: <Home/>, desc: '办理入住 (需资金 > 10,000G)。' },
  { id: 'mall', name: '黄金商业街', x: 35, y: 60, icon: <ShoppingBag/>, desc: '投资商铺 (地价10万) 与高薪打工。' },
  { id: 'club', name: '精英强化会所', x: 75, y: 20, icon: <ShieldAlert/>, desc: '随机学习【强化系】技能。' },
];

const ROLES = {
  CHIEF: '东区市长',
  DEPUTY: '东区副市长',
  NOBLE: '东区贵族'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7, 
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

export function RichAreaView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  
  // 繁荣度与数据状态
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [myShop, setMyShop] = useState<any>(null);
  const [shopName, setShopName] = useState('');
  const [shopDesc, setShopDesc] = useState('');

  const isEastSide = Object.values(ROLES).includes(user.job || '');
  const isMayor = user.job === ROLES.CHIEF;
  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;

  useEffect(() => {
    fetchAllUsers();
    const shops = JSON.parse(localStorage.getItem('shops_rich_area') || '{}');
    if (shops[user.id]) setMyShop(shops[user.id]);
  }, [selectedBuilding]);

  const fetchAllUsers = async () => {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    if (data.success) setAllPlayers(data.users || []);
  };

  // --- 繁荣度计算 ---
  const westResidents = allPlayers.filter(p => p.homeLocation === 'slums').length;
  const eastResidents = allPlayers.filter(p => p.homeLocation === 'rich_area').length;
  const westShopsCount = Object.keys(JSON.parse(localStorage.getItem('shops_slums') || '{}')).length;
  const eastShopsCount = Object.keys(JSON.parse(localStorage.getItem('shops_rich_area') || '{}')).length;
  
  const westProsperity = (westResidents * 100) + (westShopsCount * 300);
  const eastProsperity = (eastResidents * 1000) + (eastShopsCount * 3000);

  // --- 交互逻辑 ---
  const checkQualifications = (targetRank: string) => {
    if ((user.age || 0) < 16) return false; 
    const pScore = getScore(user.physicalRank);
    const mScore = getScore(user.mentalRank);
    if (targetRank === ROLES.NOBLE) return true;
    if (targetRank === ROLES.DEPUTY) return mScore >= RANK_SCORES['S+'] && pScore >= RANK_SCORES['S+'];
    if (targetRank === ROLES.CHIEF) return mScore >= RANK_SCORES['SS+'] && pScore >= RANK_SCORES['SS+'];
    return false;
  };

  const handleJoin = async (jobName: string) => {
    if (!checkQualifications(jobName)) return showToast(`资质不符！你的等级不足以胜任 ${jobName}。`);
    const res = await fetch('/api/tower/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, jobName }) });
    const data = await res.json();
    if (data.success) { showToast(`跻身上流社会，就任：${jobName}。`); fetchGlobalData(); } 
    else showToast(data.message);
  };

  const handleMoveIn = async () => {
    if ((user.gold || 0) < 10000) return showToast("门卫：抱歉，您的资产不足 10,000G，无法在东区置办房产。");
    const res = await fetch(`/api/users/${user.id}/home`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({locationId: 'rich_area'})});
    if(res.ok){ showToast('已成功买下东区庄园！城市繁荣度大幅提升 (+1000)。'); fetchGlobalData(); fetchAllUsers(); }
  };

  const handleOpenShop = async () => {
    const cost = 100000; // 地价 10万
    if ((user.gold || 0) < cost) return showToast(`资金不足！东区寸土寸金，地价需要 ${cost}G。`);
    if (!shopName) return showToast("请输入店铺名称！");

    // 扣费模拟
    await fetch('/api/commissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: `SHOP-${Date.now()}`, publisherId: user.id, title: '投资高档商铺扣款', reward: cost }) });
    
    const shopData = { name: shopName, desc: shopDesc, owner: user.name };
    const shops = JSON.parse(localStorage.getItem('shops_rich_area') || '{}');
    shops[user.id] = shopData;
    localStorage.setItem('shops_rich_area', JSON.stringify(shops));
    setMyShop(shopData);
    
    showToast(`【${shopName}】盛大开业！东市繁荣度暴涨 (+3000)！`);
    fetchGlobalData();
  };

  const handleShopWork = async () => {
    if ((user.workCount || 0) >= 3) return showToast("高净值客户已经接待完毕，今天到此为止。");
    // 东区打工：一次对戏获得 1000G
    await fetch('/api/tower/work', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    // 后台接口默认加10%，前端此处应配合单独发钱，这里仅发Toast示意逻辑，可直接操作 /api/commissions 发钱
    showToast(`成功完成了一笔上流对戏订单，店铺营收暴涨 +1000G！(效果模拟)`);
    fetchGlobalData();
  };

  const handleLearnSkill = async () => {
    // 随机获取强化系技能
    const res = await fetch('/api/skills');
    const data = await res.json();
    if (data.success) {
      const enhanceSkills = data.skills.filter((s:any) => s.faction === '强化系');
      if(enhanceSkills.length === 0) return showToast("会所暂未引进新的强化系项目。");
      const randomSkill = enhanceSkills[Math.floor(Math.random() * enhanceSkills.length)];
      
      const learnRes = await fetch(`/api/users/${user.id}/skills`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: randomSkill.name }) });
      if (learnRes.ok) showToast(`经过昂贵的私教培训，你学会了：【${randomSkill.name}】！`);
    }
  };

  return (
    <div className="absolute inset-0 bg-slate-50 overflow-hidden font-serif select-none text-slate-800">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/东市.jpg')" }}>
        <div className="absolute inset-0 bg-yellow-100/30 mix-blend-overlay pointer-events-none"></div>
      </div>

      <div className="absolute top-8 left-8 z-50">
        <button onClick={onExit} className="bg-white/90 text-emerald-800 border border-emerald-200 px-6 py-2 rounded-full font-bold shadow-xl flex items-center gap-2 hover:scale-105 transition-all">
          <ArrowLeft size={18}/> 离开富人区
        </button>
      </div>

      {buildings.map(b => (
        <div key={b.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group" style={{ left: `${b.x}%`, top: `${b.y}%` }} onClick={() => setSelectedBuilding(b)}>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-50 to-amber-100 border-2 border-amber-300 shadow-2xl flex items-center justify-center text-amber-600 group-hover:scale-110 group-hover:border-amber-500 transition-all rounded-full z-10">
              {b.icon}
            </div>
            <div className="mt-2 bg-white/95 text-emerald-900 text-[10px] font-bold px-3 py-1 rounded-full border border-emerald-100 opacity-0 group-hover:opacity-100 transition-opacity shadow-md whitespace-nowrap">
              {b.name}
            </div>
          </div>
        </div>
      ))}

      {/* 弹窗 */}
      <AnimatePresence>
        {selectedBuilding && (
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-emerald-900/30 backdrop-blur-md">
            <div className="bg-white w-full max-w-lg shadow-2xl relative rounded-[32px] border-t-8 border-amber-400 p-8">
              <button onClick={() => setSelectedBuilding(null)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors z-20">
                <X size={20} className="text-slate-500"/>
              </button>

              <div className="flex items-center gap-5 mb-8 border-b border-slate-100 pb-6 mt-2">
                <div className="p-4 bg-amber-50 rounded-2xl text-amber-600 border border-amber-200 shadow-inner">
                  {React.cloneElement(selectedBuilding.icon, { size: 32 })}
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-800">{selectedBuilding.name}</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{selectedBuilding.desc}</p>
                </div>
              </div>

              {/* === 东部市局 === */}
              {selectedBuilding.id === 'city_hall' && (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {!isEastSide ? (
                    <>
                      <div className="p-4 bg-sky-50 border border-sky-100 text-sky-800 text-sm italic rounded-xl mb-4">
                        “欢迎来到文明世界。在这里，能力、血统与财富定义了一切。”
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                         <EliteCard title="注册为东区贵族" sub="无特殊限制" qualified={checkQualifications(ROLES.NOBLE)} onClick={() => handleJoin(ROLES.NOBLE)}/>
                         <EliteCard title="竞选副市长" sub="要求: 精神S+ 肉体S+" qualified={checkQualifications(ROLES.DEPUTY)} onClick={() => handleJoin(ROLES.DEPUTY)}/>
                         <EliteCard title="登顶东区市长" sub="要求: 精神SS+ 肉体SS+" qualified={checkQualifications(ROLES.CHIEF)} onClick={() => handleJoin(ROLES.CHIEF)}/>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                      <Crown size={32} className="mx-auto text-amber-500 mb-2"/>
                      <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Current Position</p>
                      <p className="text-2xl font-black text-slate-800 mb-6">{user.job}</p>
                    </div>
                  )}

                  {/* 市长专属面板 */}
                  {isMayor && (
                    <div className="mt-6 border-t-2 border-dashed border-slate-200 pt-6">
                      <h3 className="text-lg font-black text-sky-600 mb-4 flex items-center gap-2">
                        <TrendingUp size={20}/> 城市繁荣度掌控
                      </h3>
                      <div className="flex justify-between items-center text-center mb-6">
                        <div className="flex-1 bg-slate-50 p-4 rounded-l-xl border border-slate-200 border-r-0">
                          <p className="text-xs text-slate-500 mb-1">东区繁荣度</p>
                          <p className="text-3xl font-black text-sky-500">{eastProsperity}</p>
                          <p className="text-[10px] text-slate-400 mt-2">居民:{eastResidents} 店铺:{eastShopsCount}</p>
                        </div>
                        <div className="flex-1 bg-stone-50 p-4 rounded-r-xl border border-stone-200">
                          <p className="text-xs text-stone-500 mb-1">西区繁荣度</p>
                          <p className="text-3xl font-black text-orange-400">{westProsperity}</p>
                          <p className="text-[10px] text-stone-400 mt-2">居民:{westResidents} 店铺:{westShopsCount}</p>
                        </div>
                      </div>
                      <button onClick={() => showToast(eastProsperity > westProsperity ? "制裁成功！已向西区市长征收10%的高额税赋！(模拟)" : "我们的繁荣度居然落后了，赶紧招商引资！")} className="w-full py-4 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-lg shadow-lg">
                        向西区发起经济制裁
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* === 贵族庄园：入住 === */}
              {selectedBuilding.id === 'estate' && (
                <div className="text-center space-y-6">
                  <Home size={48} className="mx-auto text-emerald-600"/>
                  <h3 className="text-xl font-bold text-slate-800">购置顶级庄园</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    东区只为真正的财富拥有者敞开大门。<br/>
                    <span className="text-emerald-600 font-bold">入住验资条件：当前资产必须大于 10,000G。</span>
                  </p>
                  {(user as any).homeLocation === 'rich_area' ? (
                    <div className="p-4 bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 rounded-xl">您已是尊贵的东区户主。</div>
                  ) : (
                    <button onClick={handleMoveIn} className="w-full py-4 bg-emerald-600 text-white font-black hover:bg-emerald-700 rounded-xl shadow-lg transition-all">
                      出示资产并办理入住
                    </button>
                  )}
                </div>
              )}

              {/* === 商业街：开店 === */}
              {selectedBuilding.id === 'mall' && (
                <div className="space-y-6">
                  {myShop ? (
                    <div className="bg-amber-50 p-6 border border-amber-200 rounded-2xl text-center">
                      <Gem size={40} className="mx-auto text-amber-500 mb-2"/>
                      <h3 className="text-xl font-black text-amber-900 mb-1">{myShop.name}</h3>
                      <p className="text-xs text-amber-700 mb-6 italic">"{myShop.desc}"</p>
                      
                      <button onClick={handleShopWork} className="w-full py-4 bg-amber-500 text-white font-black hover:bg-amber-600 rounded-xl shadow-xl shadow-amber-200">
                        出席商业剪彩 / 对戏接客 (每次 +1000G)
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-500 text-center">
                        购买黄金地段的商铺，赚取百倍于平民的利润，同时大幅拉升东区繁荣指数。
                      </p>
                      <input type="text" placeholder="输入奢侈品牌名称..." value={shopName} onChange={e=>setShopName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400"/>
                      <textarea placeholder="品牌格调简介..." value={shopDesc} onChange={e=>setShopDesc(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none h-20 focus:ring-2 focus:ring-amber-400"/>
                      <button onClick={handleOpenShop} className="w-full py-4 bg-slate-900 text-amber-400 font-black hover:bg-slate-800 rounded-xl shadow-lg transition-all">
                        全款买下地皮 (需 100,000G)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* === 精英强化会所 === */}
              {selectedBuilding.id === 'club' && (
                <div className="text-center space-y-6">
                  <ShieldAlert size={48} className="mx-auto text-sky-500"/>
                  <h3 className="text-xl font-bold text-slate-800">顶级肉体强化</h3>
                  <p className="text-sm text-slate-500">东区从不依靠蛮力，我们使用最先进的科技仪器进行机能刺激。在此可进修【强化系】奥义。</p>
                  
                  <button onClick={handleLearnSkill} className="w-full py-4 bg-sky-100 text-sky-700 font-black hover:bg-sky-200 rounded-xl transition-all">
                    申请高级强化课程 (随机获取)
                  </button>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EliteCard({ title, sub, qualified, onClick }: any) {
  return (
    <button onClick={onClick} disabled={!qualified} className={`w-full p-5 border flex justify-between items-center rounded-xl group transition-all ${qualified ? 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-lg' : 'bg-slate-100 border-slate-200 opacity-60'}`}>
      <div className="text-left">
        <div className={`font-bold text-sm ${qualified ? 'text-slate-800 group-hover:text-amber-600' : 'text-slate-500'}`}>{title}</div>
        <div className="text-[10px] text-slate-400 font-serif italic mt-1">{sub}</div>
      </div>
      {!qualified && <span className="text-[10px] text-red-500 bg-red-50 px-2 py-1 rounded-lg font-bold">等级不够</span>}
    </button>
  );
}