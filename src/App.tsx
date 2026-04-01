import React, { useState, useEffect, useCallback } from 'react';
import { 
  Film, 
  TrendingUp, 
  Search, 
  Settings, 
  Calendar as CalendarIcon, 
  ChevronRight,
  AlertCircle,
  Info,
  BarChart3,
  Globe,
  Sparkles,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { cn } from './lib/utils';

// Types
interface Movie {
  rank: string;
  movieNm: string;
  audiCnt: string;
  audiAcc: string;
}

interface TrendData {
  period: string;
  ratio: number;
}

export default function App() {
  // State for API Keys
  const [kobisKey, setKobisKey] = useState('');
  const [naverId, setNaverId] = useState('');
  const [naverSecret, setNaverSecret] = useState('');
  
  // State for Analysis Conditions
  const [targetDate, setTargetDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [keyword, setKeyword] = useState('AI');
  
  // Data State
  const [movies, setMovies] = useState<Movie[]>([]);
  const [naverTrends, setNaverTrends] = useState<TrendData[]>([]);
  const [trendingKeywords, setTrendingKeywords] = useState<string[]>(['AI', '좀비', '로맨스', '1인 가구', '멀티버스']);
  const [googleInsight, setGoogleInsight] = useState<string>('');
  const [groundingUrls, setGroundingUrls] = useState<{title: string, uri: string}[]>([]);
  
  const [loading, setLoading] = useState({ 
    kobis: false, 
    naver: false, 
    keywords: false,
    google: false 
  });
  const [error, setError] = useState({ 
    kobis: '', 
    naver: '', 
    keywords: '',
    google: '' 
  });

  // Gemini Initialization
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  // Fetch Trending Keywords via Gemini
  const fetchTrendingKeywords = async () => {
    setLoading(prev => ({ ...prev, keywords: true }));
    setError(prev => ({ ...prev, keywords: '' }));
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "현재 한국에서 영화 기획에 참고할 만한 가장 핫한 트렌드 키워드 8개를 뽑아줘. 콤마(,)로 구분해서 키워드만 출력해줘. 예: 좀비,AI,로맨스,복수",
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      const text = response.text || '';
      const keywords = text.split(',').map(k => k.trim()).filter(k => k.length > 0);
      if (keywords.length > 0) {
        setTrendingKeywords(keywords);
      }
    } catch (err) {
      setError(prev => ({ ...prev, keywords: '트렌드 키워드를 가져오는데 실패했습니다.' }));
    } finally {
      setLoading(prev => ({ ...prev, keywords: false }));
    }
  };

  // Fetch Google Trends Insight via Gemini Grounding
  const fetchGoogleInsight = async (targetKeyword: string) => {
    setLoading(prev => ({ ...prev, google: true }));
    setError(prev => ({ ...prev, google: '' }));
    setGoogleInsight('');
    setGroundingUrls([]);
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `최근 구글 트렌드와 검색 데이터를 바탕으로 '${targetKeyword}'에 대한 대중의 관심도 변화와 특징을 분석해줘. 영화 기획자 관점에서 요약해줘.`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      
      setGoogleInsight(response.text || '');
      
      // Extract grounding URLs
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        const urls = chunks
          .filter(c => c.web)
          .map(c => ({ title: c.web!.title || '출처', uri: c.web!.uri }));
        setGroundingUrls(urls);
      }
    } catch (err) {
      setError(prev => ({ ...prev, google: '구글 트렌드 분석에 실패했습니다.' }));
    } finally {
      setLoading(prev => ({ ...prev, google: false }));
    }
  };

  // Fetch KOBIS Box Office
  const fetchBoxOffice = async () => {
    if (!kobisKey) return;
    setLoading(prev => ({ ...prev, kobis: true }));
    setError(prev => ({ ...prev, kobis: '' }));
    
    try {
      const dtStr = targetDate.replace(/-/g, '');
      const response = await fetch(`/api/kobis?key=${kobisKey}&targetDt=${dtStr}`);
      const data = await response.json();
      
      if (data.boxOfficeResult?.dailyBoxOfficeList) {
        setMovies(data.boxOfficeResult.dailyBoxOfficeList);
      } else {
        setError(prev => ({ ...prev, kobis: '데이터를 불러오지 못했습니다. API 키나 날짜를 확인해주세요.' }));
      }
    } catch (err) {
      setError(prev => ({ ...prev, kobis: 'KOBIS 연동 중 에러가 발생했습니다.' }));
    } finally {
      setLoading(prev => ({ ...prev, kobis: false }));
    }
  };

  // Fetch Naver Trends
  const fetchNaverTrends = async () => {
    if (!naverId || !naverSecret) return;
    setLoading(prev => ({ ...prev, naver: true }));
    setError(prev => ({ ...prev, naver: '' }));
    
    try {
      const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const endDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      
      const body = {
        startDate,
        endDate,
        timeUnit: "date",
        keywordGroups: [{ groupName: keyword, keywords: [keyword] }]
      };
      
      const response = await fetch('/api/naver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: naverId, clientSecret: naverSecret, body })
      });
      
      const data = await response.json();
      if (response.ok && data.results?.[0]?.data) {
        setNaverTrends(data.results[0].data);
      } else {
        setError(prev => ({ ...prev, naver: '네이버 API 요청 실패 - 키를 확인해주세요.' }));
      }
    } catch (err) {
      setError(prev => ({ ...prev, naver: '네이버 연동 중 에러가 발생했습니다.' }));
    } finally {
      setLoading(prev => ({ ...prev, naver: false }));
    }
  };

  useEffect(() => {
    if (kobisKey) fetchBoxOffice();
  }, [targetDate, kobisKey]);

  useEffect(() => {
    if (naverId && naverSecret) fetchNaverTrends();
    fetchGoogleInsight(keyword);
  }, [keyword, naverId, naverSecret]);

  useEffect(() => {
    fetchTrendingKeywords();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex text-[#212529] font-sans">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-gray-200 flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="p-6 border-bottom border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Film className="text-indigo-600 w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight">Trend Dashboard</h1>
          </div>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Director's Toolkit</p>
        </div>

        <div className="p-6 space-y-8">
          {/* API Settings */}
          <section>
            <div className="flex items-center gap-2 mb-4 text-gray-700">
              <Settings className="w-4 h-4" />
              <h2 className="text-sm font-bold uppercase tracking-wider">API Settings</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">KOBIS API Key</label>
                <input 
                  type="password" 
                  value={kobisKey}
                  onChange={(e) => setKobisKey(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="Enter KOBIS Key"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Naver Client ID</label>
                <input 
                  type="password" 
                  value={naverId}
                  onChange={(e) => setNaverId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="Enter Naver ID"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Naver Client Secret</label>
                <input 
                  type="password" 
                  value={naverSecret}
                  onChange={(e) => setNaverSecret(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="Enter Naver Secret"
                />
              </div>
            </div>
          </section>

          {/* Analysis Conditions */}
          <section>
            <div className="flex items-center gap-2 mb-4 text-gray-700">
              <Search className="w-4 h-4" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Analysis Conditions</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Box Office Date</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="date" 
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Manual Keyword</label>
                <input 
                  type="text" 
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="e.g. AI, Zombie, Romance"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="mt-auto p-6 border-t border-gray-100 bg-gray-50">
          <p className="text-[10px] text-gray-400 leading-relaxed">
            * 박스오피스 데이터는 전일 기준입니다.<br />
            * 네이버 트렌드는 최근 30일 데이터입니다.
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-2">🎬 영화 기획 트렌드 대시보드</h2>
            <p className="text-gray-500">대중의 관심사와 박스오피스 동향을 한눈에 파악하세요.</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Last Updated</p>
            <p className="text-sm font-semibold">{format(new Date(), 'yyyy.MM.dd HH:mm')}</p>
          </div>
        </header>

        {/* Trending Keywords Section */}
        <section className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-200" />
              <h3 className="font-bold text-lg">실시간 추천 트렌드 키워드</h3>
            </div>
            <button 
              onClick={fetchTrendingKeywords}
              disabled={loading.keywords}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4", loading.keywords && "animate-spin")} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {trendingKeywords.map((kw) => (
              <button
                key={kw}
                onClick={() => setKeyword(kw)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  keyword === kw 
                    ? "bg-white text-indigo-600 shadow-md scale-105" 
                    : "bg-white/10 hover:bg-white/20 text-white"
                )}
              >
                # {kw}
              </button>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Section 1: KOBIS Box Office */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-bold text-lg">1. 일일 박스오피스</h3>
              </div>
              <span className="text-xs font-medium px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full">
                {targetDate}
              </span>
            </div>
            
            <div className="p-6 flex-1">
              {!kobisKey ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-3">
                  <Info className="w-12 h-12 opacity-20" />
                  <p className="text-sm">사이드바에 KOBIS API 키를 입력해주세요.</p>
                </div>
              ) : loading.kobis ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : error.kobis ? (
                <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error.kobis}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                        <th className="pb-4 pl-2">순위</th>
                        <th className="pb-4">영화제목</th>
                        <th className="pb-4 text-right pr-2">관객수</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {movies.slice(0, 5).map((movie) => (
                        <tr key={movie.rank} className="group hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 pl-2">
                            <span className={cn(
                              "inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold",
                              movie.rank === '1' ? "bg-amber-100 text-amber-700" : 
                              movie.rank === '2' ? "bg-slate-100 text-slate-700" :
                              movie.rank === '3' ? "bg-orange-50 text-orange-700" : "text-gray-500"
                            )}>
                              {movie.rank}
                            </span>
                          </td>
                          <td className="py-4 font-semibold text-sm truncate max-w-[150px]">{movie.movieNm}</td>
                          <td className="py-4 text-right text-sm font-mono pr-2">{Number(movie.audiCnt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Section 2: Naver Trends */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="font-bold text-lg">2. 네이버 검색 트렌드</h3>
              </div>
              <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">
                {keyword}
              </span>
            </div>

            <div className="p-6 flex-1">
              {!naverId || !naverSecret ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-3">
                  <Info className="w-12 h-12 opacity-20" />
                  <p className="text-sm">사이드바에 네이버 API 정보를 입력해주세요.</p>
                </div>
              ) : loading.naver ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                </div>
              ) : error.naver ? (
                <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error.naver}
                </div>
              ) : (
                <div className="h-[250px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={naverTrends}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="period" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fill: '#9CA3AF'}}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fill: '#9CA3AF'}}
                      />
                      <Tooltip 
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="ratio" 
                        stroke="#10B981" 
                        strokeWidth={3} 
                        dot={false}
                        activeDot={{r: 6, strokeWidth: 0}}
                        name="검색 비율"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Section 3: Google Trends Analysis (AI Powered) */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-bold text-lg">3. AI 구글 트렌드 인사이트</h3>
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
              Real-time Analysis
            </span>
          </div>
          <div className="p-8">
            {loading.google ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                <p className="text-sm text-gray-500 animate-pulse">구글 트렌드 데이터를 분석 중입니다...</p>
              </div>
            ) : error.google ? (
              <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
                <AlertCircle className="w-4 h-4" />
                {error.google}
              </div>
            ) : googleInsight ? (
              <div className="space-y-6">
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                  <div className="whitespace-pre-wrap">{googleInsight}</div>
                </div>
                
                {groundingUrls.length > 0 && (
                  <div className="pt-6 border-t border-gray-100">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">분석 출처</h4>
                    <div className="flex flex-wrap gap-3">
                      {groundingUrls.slice(0, 3).map((url, i) => (
                        <a 
                          key={i}
                          href={url.uri} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {url.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-3">
                <Globe className="w-12 h-12 opacity-20" />
                <p className="text-sm">키워드를 선택하거나 입력하여 분석을 시작하세요.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
