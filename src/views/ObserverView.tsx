import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, X, Eye, BookOpen, 
  Database, UserSecret, Monitor, 
  Feather, Skull, Users, Globe
} from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

// 建筑点坐标
const buildings = [
  { id: 'entrance', name: '监控总控室', x: 20, y: 30, icon: <Eye/>, desc: '掌控世界的情报网节点，入职通道。' },
  { id: 'library', name: '真理大图书馆', x: 75, y: 35, icon: <BookOpen/>, desc: '记载着所有人的过去、现在与死亡。' },
  { id: 'intel_collect', name: '情报搜集部', x: 35, y: 70, icon: <Globe/>, desc: '派遣耳目去各个阵营窃取信息。' },
  { id: 'intel_process', name: '情报处理处', x: 60, y: 65, icon: <Database/>, desc: '解密加密波段，整理混沌的数据。' }
];

// 职位常量
const ROLES = {
  BOSS: '观察者首领',
  COLLECTOR: '情报搜集员',
  PROCESSOR: '情报处理员'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7, 
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

// 模拟的图书数据库 (前端状态维持)
const initialBooks = [
  { title: "命之塔的起源猜测", author: "初代观察者", content: "有人说塔是从地底长出来的，也有人说是神使从天外抛下的巨石..." },
  { title: "论哨兵狂暴的不可逆性", author: "情报处理员-K", content: "如果不加干预，狂暴值超过100%的哨兵最终都会走向自我毁灭..." }
];

export function ObserverView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [isHacking, setIsHacking] = useState(false);
  
  // 图书馆相关状态
  const [libraryTab, setLibraryTab] = useState<'records' | 'tombstones' | 'books'>('records');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [books, setBooks] = useState(initialBooks);
  const [newBook, setNewBook] = useState({ title: '', content: '' });
  const [isWriting, setIsWriting] = useState(false);

  // 身份判断
  const isObserver = Object.values(ROLES).includes(user.job || '');
  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;

  // 当进入图书馆时获取全服数据
  useEffect(() => {
    if (selectedBuilding?.id === 'library') {
      fetchAllUsers();
    }
  }, [selectedBuilding]);

  const fetchAllUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setAllUsers(data.users || []);
      }
    } catch (e) {
      console.error("无法获取人员档案");
    }
  };

  // --- 入职与资质校验 ---
  const checkQualifications = (targetRank: string) => {
    if ((user.age || 0) < 16) return false; // 必须满16岁
    
    const pScore = getScore(user.physicalRank);
    const mScore = getScore(user.mentalRank);
    
    if (targetRank === ROLES.COLLECTOR) return pScore >= RANK_SCORES['C+']; // 搜集员：体C+，神不限
    if (targetRank === ROLES.PROCESSOR) return mScore >= RANK_SCORES['C+']; // 处理员：神C+，体不限
    if (targetRank === ROLES.BOSS) return mScore >= RANK_SCORES['S+'] && pScore >= RANK_SCORES['S+']; // 首领：双S+
    return false;
  };

  const handleJoinOrPromote = async (targetRank: string) => {
    if (!checkQualifications(targetRank)) {
      return showToast(`资质不符！${targetRank} 需要相应的等级要求，或你未满16岁。`);
    }

    const res = await fetch('/api/tower/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, jobName: targetRank })
    });
    
    const data = await res.json();
    if (data.success) {
      showToast(`连接建立。欢迎加入真理的网络，${targetRank}。`);
      fetchGlobalData();
    } else {
      showToast(data.message || '操作失败');
    }
  };

  // --- 打工（情报工作） ---
  const handleWork = async (type: 'collect' | 'process') => {
    if ((user.workCount || 0) >= 3) return showToast("今日的脑机接口负荷已达上限。");

    const res = await fetch('/api/tower/work', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ userId: user.id })
    });
    const data = await res.json();

    if (data.success) {
      setIsHacking(true);
      setTimeout(() => setIsHacking(false), 2000);

      let msg = "";
      if (type === 'collect') msg = "骇入成功！截获了一份关于守塔会人员调动的加密文档。";
      if (type === 'process') msg = "破译完成！从乱码中解析出了地下黑市的交易流水。";

      showToast(`${msg} (津贴 +${data.reward}G)`);
      fetchGlobalData();
    }
  };

  // --- 图书馆：发布新书 ---
  const handlePublishBook = () => {
    if (!newBook.title.trim() || !newBook.content.trim()) {
      return showToast("书名和内容不能为空。");
    }
    setBooks([{ title: newBook.title, author: user.name, content: newBook.content }, ...books]);
    setNewBook({ title: '', content: '' });
    setIsWriting(false);
    showToast("新资料已归档入库，全塔可见。");
  };

  return (
    <div className="absolute inset-0 bg-black overflow-hidden font-mono select-none text-green-500">
      {/* 背景层 */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: "url('/观察者.jpg')" }}
      ></div>
      {/* 黑客/赛博风扫描线滤镜 */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_2px,3px_100%] pointer-events-none"></div>

      {/* 顶部导航 */}
      <div className="absolute top-8 left-8 z-50">
        <button 
          onClick={onExit} 
          className="bg-black/80 text-green-500 border border-green-700 px-6 py-2 rounded-sm font-bold shadow-[0_0_10px_rgba(0,255,0,0.2)] flex items-center gap-2 hover:bg-green-900/20 transition-all"
        >
          <ArrowLeft size={18}/> 断开连接
        </button>
      </div>

      {/* 建筑交互点 */}
      {buildings.map(b => (
        <div 
          key={b.id} 
          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group"
          style={{ left: `${b.x}%`, top: `${b.y}%` }}
          onClick={() => setSelectedBuilding(b)}
        >
          <div className="flex flex-col items-center">
            {/* 科技感图标 */}
            <div className="w-16 h-16 bg-black/80 border border-green-600 shadow-[0_0_15px_rgba(0,255,0,0.3)] flex items-center justify-center text-green-400 group-hover:scale-110 group-hover:bg-green-900 group-hover:text-white transition-all rounded-full z-10 relative overflow-hidden">
               {/* 扫描动画 */}
               <div className="absolute top-0 left-0 w-full h-1 bg-green-500/50 animate-[scan_2s_linear_infinite]"></div>
              {b.icon}
            </div>
            <div className="mt-2 bg-black/90 text-green-400 text-[10px] font-bold px-2 py-1 border border-green-800 opacity-0 group-hover:opacity-100 transition-opacity">
              {b.name}
            </div>
          </div>
        </div>
      ))}

      {/* 黑客特效 */}
      <AnimatePresence>
        {isHacking && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80"
          >
            <div className="text-center font-mono">
               <Monitor size={64} className="mx-auto text-green-500 animate-pulse mb-4"/>
               <p className="text-green-500 text-xl overflow-hidden whitespace-nowrap border-r-4 border-green-500 animate-typing">
                 ACCESSING SECURE MAINFRAME... 100%
               </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 建筑详情弹窗 */}
      <AnimatePresence>
        {selectedBuilding && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          >
            <div className="bg-black w-full max-w-3xl shadow-[0_0_30px_rgba(0,255,0,0.15)] relative border border-green-800 p-1 flex flex-col max-h-[85vh]">
              {/* 四角装饰 */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-500"></div>
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-500"></div>
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-500"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-500"></div>

              <button onClick={() => {setSelectedBuilding(null); setIsWriting(false);}} className="absolute top-6 right-6 text-green-700 hover:text-green-400 transition-colors z-20">
                <X size={24}/>
              </button>

              <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                <div className="flex items-center gap-5 mb-8 border-b border-green-900 pb-6">
                  <div className="p-4 bg-green-900/20 rounded text-green-500 border border-green-800">
                    {React.cloneElement(selectedBuilding.icon, { size: 32 })}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-green-400 tracking-wider font-mono uppercase">{selectedBuilding.name}</h2>
                    <p className="text-xs text-green-700 font-bold mt-1 uppercase">{selectedBuilding.desc}</p>
                  </div>
                </div>

                {/* === 总控室：入职 === */}
                {selectedBuilding.id === 'entrance' && (
                  <div className="space-y-6">
                    {!isObserver ? (
                      <>
                        <div className="p-4 bg-green-900/10 border border-green-800 text-xs text-green-600 font-mono leading-relaxed">
                          > SYSTEM: 正在扫描访客特征...<br/>
                          > 信息就是力量，而我们掌控着最大的服务器。<br/>
                          > 年满16岁方可被授予访问权限。
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <IntelJobBtn 
                             title="情报搜集员" sub="肉体C+ | 负责外勤盗取" 
                             qualified={checkQualifications(ROLES.COLLECTOR)}
                             onClick={() => handleJoinOrPromote(ROLES.COLLECTOR)}
                           />
                           <IntelJobBtn 
                             title="情报处理员" sub="精神C+ | 负责内勤解密" 
                             qualified={checkQualifications(ROLES.PROCESSOR)}
                             onClick={() => handleJoinOrPromote(ROLES.PROCESSOR)}
                           />
                           <div className="col-span-1 md:col-span-2">
                             <IntelJobBtn 
                               title="篡夺首领权限" sub="神S+ 体S+ | ROOT 权限" 
                               qualified={checkQualifications(ROLES.BOSS)}
                               onClick={() => handleJoinOrPromote(ROLES.BOSS)}
                             />
                           </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-8 border border-green-800 bg-green-900/5">
                        <UserSecret size={48} className="mx-auto text-green-600 mb-2"/>
                        <p className="text-green-800 text-xs font-bold mb-1 tracking-widest">AGENT STATUS: ACTIVE</p>
                        <h3 className="text-2xl font-bold text-green-400 mb-2">{user.job}</h3>
                        <p className="text-green-600 text-sm mb-6">保持警惕，真理永远在暗处。</p>
                        
                        {user.job !== ROLES.BOSS && (
                          <button onClick={() => handleJoinOrPromote(ROLES.BOSS)} className="w-full py-3 mb-4 bg-green-900/20 text-green-400 font-bold border border-green-700 hover:bg-green-800 hover:text-white transition-colors">
                            申请 ROOT 权限 (晋升首领: 神S+ 体S+)
                          </button>
                        )}

                        <button 
                          onClick={() => { if(confirm("断开连接将抹除你的内部档案（辞职），确定吗？")) fetch('/api/tower/quit', { method:'POST', body:JSON.stringify({userId:user.id}), headers:{'Content-Type':'application/json'}}).then(() => {showToast("连接已终止"); fetchGlobalData(); setSelectedBuilding(null);}) }}
                          className="text-xs text-red-500 hover:text-red-400 underline"
                        >
                          断开神经连接 / 离职
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* === 情报搜集/处理：打工 === */}
                {['intel_collect', 'intel_process'].includes(selectedBuilding.id) && (
                  <div className="space-y-6 text-center">
                     <div className="p-6 bg-green-900/10 border border-green-800">
                        {selectedBuilding.id === 'intel_collect' ? (
                          <>
                            <Globe size={48} className="mx-auto text-green-600 mb-4 animate-spin-slow"/>
                            <p className="text-sm text-green-500 mb-4">潜入其他阵营的通讯频段，拦截第一手情报资料。</p>
                          </>
                        ) : (
                          <>
                            <Database size={48} className="mx-auto text-green-600 mb-4"/>
                            <p className="text-sm text-green-500 mb-4">在海量的垃圾数据中抽丝剥茧，提取高价值的机密流水。</p>
                          </>
                        )}
                        
                        {isObserver ? (
                          <button 
                            onClick={() => handleWork(selectedBuilding.id === 'intel_collect' ? 'collect' : 'process')} 
                            disabled={(user.workCount||0)>=3} 
                            className="w-full py-4 bg-green-900/40 text-green-400 font-bold border border-green-600 hover:bg-green-700 hover:text-black disabled:opacity-50 disabled:border-green-900 transition-all uppercase tracking-widest"
                          >
                            执行任务 ({3 - (user.workCount||0)}/3)
                          </button>
                        ) : (
                          <div className="text-center text-xs text-red-600 font-bold border border-red-900 bg-red-900/20 p-3">
                            [ ERROR ] 权限不足。非观察者成员无法访问控制台。
                          </div>
                        )}
                     </div>
                  </div>
                )}

                {/* === 真理大图书馆：资料、墓碑、写书 === */}
                {selectedBuilding.id === 'library' && (
                  <div className="space-y-6">
                    {/* 图书馆导航栏 */}
                    <div className="flex border-b border-green-900">
                      <LibTab active={libraryTab==='records'} onClick={() => setLibraryTab('records')} icon={<Users size={16}/>} label="人员档案" />
                      <LibTab active={libraryTab==='tombstones'} onClick={() => setLibraryTab('tombstones')} icon={<Skull size={16}/>} label="死亡名录" />
                      <LibTab active={libraryTab==='books'} onClick={() => setLibraryTab('books')} icon={<BookOpen size={16}/>} label="机密文献" />
                    </div>

                    {/* 人员档案 (入离职记录) */}
                    {libraryTab === 'records' && (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                        <p className="text-xs text-green-700 mb-4">> [检索结果] 全局玩家驻扎与任职快照：</p>
                        {allUsers.filter(u => u.status !== 'dead').length === 0 && <p className="text-green-800 text-sm">暂无存活人员记录。</p>}
                        {allUsers.filter(u => u.status !== 'dead').map(u => (
                          <div key={u.id} className="p-3 border border-green-900/50 bg-green-900/10 flex justify-between items-center hover:border-green-600 transition-colors">
                            <div>
                              <span className="font-bold text-green-400 mr-2">{u.name}</span>
                              <span className="text-[10px] text-green-600 bg-green-900/30 px-2 py-0.5 rounded">{u.faction || '未定'}</span>
                            </div>
                            <div className="text-xs text-green-500 font-mono">
                              [ {u.job !== '无' ? `任职: ${u.job}` : '暂无势力归属'} ]
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 死亡名录 (墓碑) */}
                    {libraryTab === 'tombstones' && (
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                        <p className="text-xs text-green-700 mb-4">> [检索结果] 已确认为死亡状态的档案：</p>
                        {allUsers.filter(u => u.status === 'dead').length === 0 ? (
                          <p className="text-green-600 text-sm text-center py-8 opacity-50">数据正常，目前无人死亡。</p>
                        ) : (
                          allUsers.filter(u => u.status === 'dead').map(u => (
                            <div key={u.id} className="p-4 border border-red-900/30 bg-red-900/10 relative overflow-hidden group">
                              <Skull className="absolute -bottom-2 -right-2 text-red-900/20 w-16 h-16 transform -rotate-12"/>
                              <div className="relative z-10">
                                <h4 className="font-black text-red-500 text-lg mb-1">{u.name} <span className="text-xs font-normal text-red-700">({u.role})</span></h4>
                                <p className="text-xs text-green-600/80 mb-2">死因 / 绝笔：</p>
                                <p className="text-sm text-red-300 font-serif italic border-l-2 border-red-800 pl-3">"{u.deathDescription || '无记载'}"</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* 机密文献 (写书与阅读) */}
                    {libraryTab === 'books' && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs text-green-700">> [文献库] 世界真相与调查报告：</p>
                          {isObserver && !isWriting && (
                            <button onClick={() => setIsWriting(true)} className="flex items-center gap-1 text-xs bg-green-900/30 text-green-400 px-3 py-1.5 border border-green-600 hover:bg-green-700 hover:text-black transition-colors">
                              <Feather size={14}/> 撰写新文献
                            </button>
                          )}
                        </div>

                        {/* 写书表单 */}
                        {isWriting && (
                          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 border border-green-500 bg-green-900/20 space-y-3 mb-6">
                            <input 
                              type="text" 
                              placeholder="文献标题..."
                              value={newBook.title}
                              onChange={e => setNewBook({...newBook, title: e.target.value})}
                              className="w-full p-2 bg-black border border-green-800 text-green-400 focus:border-green-500 outline-none"
                            />
                            <textarea 
                              placeholder="正文内容（揭露你所知道的真相）..."
                              value={newBook.content}
                              onChange={e => setNewBook({...newBook, content: e.target.value})}
                              className="w-full p-2 bg-black border border-green-800 text-green-400 focus:border-green-500 outline-none h-32 custom-scrollbar"
                            />
                            <div className="flex gap-2">
                              <button onClick={handlePublishBook} className="flex-1 py-2 bg-green-700 text-black font-bold hover:bg-green-600">归档保存</button>
                              <button onClick={() => setIsWriting(false)} className="flex-1 py-2 bg-transparent text-green-600 font-bold border border-green-800 hover:border-green-600">取消</button>
                            </div>
                          </motion.div>
                        )}

                        {/* 图书列表 */}
                        <div className="grid grid-cols-1 gap-4 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                          {books.map((book, idx) => (
                            <div key={idx} className="p-5 border border-green-900/50 bg-black hover:border-green-500 transition-colors group">
                              <div className="flex justify-between items-start mb-3">
                                <h3 className="font-bold text-green-400 text-lg group-hover:text-green-300">{book.title}</h3>
                                <span className="text-[10px] text-green-700 bg-green-900/20 px-2 py-1">作者: {book.author}</span>
                              </div>
                              <p className="text-xs text-green-600/80 leading-relaxed font-serif whitespace-pre-wrap">{book.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 底部 CSS 动画定义 */}
      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes typing {
          from { width: 0 }
          to { width: 100% }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #064e3b; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #059669; }
      `}</style>
    </div>
  );
}

// 子组件
function IntelJobBtn({ title, sub, qualified, onClick }: any) {
  return (
    <button 
      onClick={onClick} 
      disabled={!qualified}
      className={`w-full p-4 border flex flex-col items-start transition-all relative overflow-hidden text-left
        ${qualified ? 'border-green-700 hover:border-green-400 bg-green-900/10 hover:bg-green-900/30' : 'border-green-900 bg-black opacity-50 cursor-not-allowed'}
      `}
    >
      <span className={`font-bold text-sm ${qualified ? 'text-green-400' : 'text-green-800'}`}>{title}</span>
      <span className="text-[10px] text-green-600 mt-1">{sub}</span>
      {!qualified && <span className="absolute top-2 right-2 text-[9px] font-bold text-red-600 bg-red-900/30 px-1 border border-red-800">条件不符</span>}
    </button>
  );
}

function LibTab({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors text-sm font-bold
        ${active ? 'border-green-500 text-green-400 bg-green-900/20' : 'border-transparent text-green-800 hover:text-green-600 hover:bg-green-900/10'}
      `}
    >
      {icon} {label}
    </button>
  );
}