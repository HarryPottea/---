import React, { useState, useEffect, useCallback, Component } from 'react';
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
  ExternalLink,
  Menu,
  X
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
import { cn } from './lib/utils';
import './firebase'; // Import to run connection test

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-red-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">문제가 발생했습니다</h2>
            <p className="text-gray-600 mb-6">애플리케이션을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left overflow-auto max-h-40">
              <code className="text-xs text-red-500">{this.state.error?.toString()}</code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Types
interface Movie {
  rank: string;
  movieNm: string;
  audiCnt: string;
  audiAcc: string;
  genre?: string;
}

interface TrendData {
  period: string;
  ratio: number;
}

interface RecommendedKeyword {
  keyword: string;
  recommendationScore: number;
  trendState: string;
  reasonText: string;
  sourceSummary: string[];
}

export default function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}

function Dashboard() {
  // State for Analysis Conditions
  const [targetDate, setTargetDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [keyword, setKeyword] = useState('AI');
  
  // Data State
  const [movies, setMovies] = useState<Movie[]>([]);
  const [naverTrends, setNaverTrends] = useState<TrendData[]>([]);
  const [recommendedKeywords, setRecommendedKeywords] = useState<RecommendedKeyword[]>([]);
  const [googleInsight, setGoogleInsight] = useState<string>('');
  const [groundingUrls, setGroundingUrls] = useState<{title: string, uri: string}[]>([]);
  const [insightCache, setInsightCache] = useState<Record<string, { text: string, urls: {title: string, uri: string}[], source?: string }>>({});
  const [insightSource, setInsightSource] = useState<string>('');
  
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Fetch Recommended Keywords via Data-Driven API
  const fetchTrendingKeywords = async () => {
    setLoading(prev => ({ ...prev, keywords: true }));
    setError(prev => ({ ...prev, keywords: '' }));
    try {
      const response = await fetch('/api/recommended-keywords');
      const text = await response.text();
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Recommended Keywords JSON Parse Error. Response text:", text);
        throw new Error(`서버 응답 파싱 실패: ${text.slice(0, 150)}`);
      }

      if (!response.ok || !data.ok) {
        const errorMsg = data.error || `추천 키워드 조회 실패 (상태 코드: ${response.status})`;
        const detail = data.detail ? ` (${data.detail})` : "";
        throw new Error(errorMsg + detail);
      }

      if (data.data) {
        setRecommendedKeywords(data.data);
        if (data.data.length > 0 && keyword === 'AI') {
          setKeyword(data.data[0].keyword);
        }
      }
    } catch (err: any) {
      setError(prev => ({ ...prev, keywords: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, keywords: false }));
    }
  };

  // Fetch Google Trends Insight via Serverless Gemini
  const fetchGoogleInsight = async (targetKeyword: string, force: boolean = false) => {
    // Check frontend cache first
    if (!force && insightCache[targetKeyword]) {
      setGoogleInsight(insightCache[targetKeyword].text);
      setGroundingUrls(insightCache[targetKeyword].urls);
      setInsightSource(insightCache[targetKeyword].source || 'cache');
      setError(prev => ({ ...prev, google: '' }));
      return;
    }

    setLoading(prev => ({ ...prev, google: true }));
    setError(prev => ({ ...prev, google: '' }));
    setGoogleInsight('');
    setGroundingUrls([]);
    setInsightSource('');
    
    try {
      const response = await fetch(`/api/gemini?keyword=${encodeURIComponent(targetKeyword)}`);
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Gemini Insight JSON Parse Error. Response text:", text);
        if (text.includes("<!doctype html>") || text.includes("<html")) {
          throw new Error("서버에서 HTML 응답이 반환되었습니다. API 경로가 올바르지 않거나 배포 설정에 문제가 있을 수 있습니다.");
        }
        throw new Error(`서버 응답 파싱 실패: ${text.substring(0, 50)}...`);
      }

      if (!response.ok || !data.ok) {
        const errorMsg = data.error || `구글 트렌드 분석 실패 (상태 코드: ${response.status})`;
        const detail = data.detail ? ` (${data.detail})` : "";
        throw new Error(errorMsg + detail);
      }

      if (data.data?.insight) {
        const resultText = data.data.insight;
        const source = data.source || 'gemini';
        let urls: {title: string, uri: string}[] = [];
        
        // Extract grounding URLs
        const chunks = data.data.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          urls = chunks
            .filter((c: any) => c.web)
            .map((c: any) => ({ title: c.web!.title || '출처', uri: c.web!.uri }));
        }
        
        setGoogleInsight(resultText);
        setGroundingUrls(urls);
        setInsightSource(source);
        
        // Save to frontend cache
        setInsightCache(prev => ({
          ...prev,
          [targetKeyword]: { text: resultText, urls, source }
        }));
      } else {
        throw new Error("분석 결과 데이터가 올바르지 않습니다.");
      }
    } catch (err: any) {
      setError(prev => ({ ...prev, google: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, google: false }));
    }
  };

  // Fetch KOBIS Box Office
  const fetchBoxOffice = async () => {
    setLoading(prev => ({ ...prev, kobis: true }));
    setError(prev => ({ ...prev, kobis: '' }));
    
    try {
      const dtStr = targetDate.replace(/-/g, '');
      const response = await fetch(`/api/kobis?targetDt=${dtStr}`);
      const text = await response.text();
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("KOBIS JSON Parse Error. Response text:", text);
        throw new Error(`서버 응답 파싱 실패: ${text.slice(0, 150)}`);
      }

      if (!response.ok || !data.ok) {
        const errorMsg = data.error || `데이터를 불러오지 못했습니다. (상태 코드: ${response.status})`;
        const detail = data.detail ? ` (${data.detail})` : "";
        throw new Error(errorMsg + detail);
      }

      if (data.boxOfficeResult?.dailyBoxOfficeList) {
        setMovies(data.boxOfficeResult.dailyBoxOfficeList);
      } else {
        throw new Error("올바른 박스오피스 데이터 형식이 아닙니다.");
      }
    } catch (err: any) {
      setError(prev => ({ ...prev, kobis: `KOBIS 연동 중 에러가 발생했습니다: ${err.message}` }));
    } finally {
      setLoading(prev => ({ ...prev, kobis: false }));
    }
  };

  // Fetch Naver Trends
  const fetchNaverTrends = async () => {
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
        body: JSON.stringify({ body })
      });
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Naver JSON Parse Error. Response text:", text);
        throw new Error(`서버 응답 파싱 실패: ${text.slice(0, 150)}`);
      }

      if (!response.ok || !data.ok) {
        const errorMsg = data.error || `네이버 API 요청 실패 (상태 코드: ${response.status})`;
        const detail = data.detail ? ` (${data.detail})` : "";
        throw new Error(errorMsg + detail);
      }

      if (data.results?.[0]?.data) {
        setNaverTrends(data.results[0].data);
      } else {
        throw new Error("올바른 네이버 트렌드 데이터 형식이 아닙니다.");
      }
    } catch (err: any) {
      setError(prev => ({ ...prev, naver: `네이버 연동 중 에러가 발생했습니다: ${err.message}` }));
    } finally {
      setLoading(prev => ({ ...prev, naver: false }));
    }
  };

  useEffect(() => {
    fetchBoxOffice();
  }, [targetDate]);

  useEffect(() => {
    fetchNaverTrends();
    fetchGoogleInsight(keyword);
  }, [keyword]);

  useEffect(() => {
    fetchTrendingKeywords();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col text-[#212529] font-sans">
      <div className="flex flex-col lg:flex-row flex-1 relative">
        {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-gray-200 p-4 sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Film className="text-indigo-600 w-6 h-6" />
          <h1 className="text-lg font-bold tracking-tight">Production CEW</h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "w-full lg:w-80 bg-white border-r border-gray-200 flex flex-col lg:sticky lg:top-0 lg:h-screen overflow-y-auto transition-all duration-300 ease-in-out",
        isSidebarOpen ? "max-h-[1000px] opacity-100 visible" : "max-h-0 lg:max-h-none opacity-0 lg:opacity-100 invisible lg:visible"
      )}>
        <div className="hidden lg:block p-6 border-bottom border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Film className="text-indigo-600 w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight">Production CEW</h1>
          </div>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Director's Toolkit</p>
        </div>

        <div className="p-6 space-y-8">
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
            * API 키가 서버에 안전하게 설정되었습니다.<br />
            * 박스오피스 데이터는 전일 기준입니다.<br />
            * 네이버 트렌드는 최근 30일 데이터입니다.
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-8 max-w-6xl mx-auto space-y-8 w-full overflow-x-hidden">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">🎬 영화 기획 트렌드 대시보드</h2>
            <p className="text-sm sm:text-base text-gray-500">대중의 관심사와 박스오피스 동향을 한눈에 파악하세요.</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Last Updated</p>
            <p className="text-xs sm:text-sm font-semibold">{format(new Date(), 'yyyy.MM.dd HH:mm')}</p>
          </div>
        </header>

        {/* Trending Keywords Section */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-200" />
              <h3 className="font-bold text-lg">데이터 기반 추천 트렌드 키워드</h3>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={async () => {
                  setLoading(prev => ({ ...prev, keywords: true }));
                  await fetch('/api/collect-trends');
                  await fetchTrendingKeywords();
                }}
                disabled={loading.keywords}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-xs font-medium disabled:opacity-50"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loading.keywords && "animate-spin")} />
                데이터 수집 및 갱신
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {loading.keywords ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : error.keywords ? (
              <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error.keywords}
              </div>
            ) : recommendedKeywords.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendedKeywords.map((item) => (
                  <button
                    key={item.keyword}
                    onClick={() => setKeyword(item.keyword)}
                    className={cn(
                      "text-left p-4 rounded-xl border transition-all group relative overflow-hidden",
                      keyword === item.keyword 
                        ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600 shadow-md" 
                        : "border-gray-100 hover:border-indigo-200 hover:bg-gray-50"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-base"># {item.keyword}</span>
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter",
                        item.trendState === '급상승' ? "bg-red-100 text-red-600" :
                        item.trendState === '상승 중' ? "bg-orange-100 text-orange-600" :
                        "bg-gray-100 text-gray-600"
                      )}>
                        {item.trendState}
                      </span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div className="space-y-1">
                        <p className="text-[11px] text-gray-500 line-clamp-1">{item.reasonText}</p>
                        <div className="flex gap-1">
                          {item.sourceSummary.map(s => (
                            <span key={s} className="text-[9px] bg-gray-200 text-gray-600 px-1 rounded">{s}</span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 uppercase font-bold leading-none mb-1">Score</p>
                        <p className="text-xl font-black text-indigo-600 leading-none">{item.recommendationScore}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Info className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">추천 키워드 데이터가 없습니다. 상단의 '데이터 수집' 버튼을 눌러주세요.</p>
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Section 1: KOBIS Box Office */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-bold text-base sm:text-lg">1. 일일 박스오피스</h3>
            </div>
            <span className="text-[10px] sm:text-xs font-medium px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full">
              {targetDate}
            </span>
          </div>
          
          <div className="p-4 sm:p-6 flex-1">
              {loading.kobis ? (
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
                        <th className="pb-4">장르</th>
                        <th className="pb-4 text-right">당일 관객</th>
                        <th className="pb-4 text-right pr-2">누적 관객</th>
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
                          <td className="py-4 font-semibold text-sm truncate max-w-[120px] sm:max-w-[150px]">{movie.movieNm}</td>
                          <td className="py-4 text-xs text-gray-500 truncate max-w-[80px] sm:max-w-[100px]">{movie.genre || '-'}</td>
                          <td className="py-4 text-right text-xs sm:text-sm font-mono">{Number(movie.audiCnt).toLocaleString()}</td>
                          <td className="py-4 text-right text-xs sm:text-sm font-mono pr-2 text-gray-500">{Number(movie.audiAcc).toLocaleString()}</td>
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
          <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-bold text-base sm:text-lg">2. 네이버 검색 트렌드</h3>
            </div>
            <span className="text-[10px] sm:text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">
              {keyword}
            </span>
          </div>

          <div className="p-4 sm:p-6 flex-1">
              {loading.naver ? (
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
          <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-bold text-base sm:text-lg">3. AI 구글 트렌드 인사이트</h3>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              {insightSource && (
                <span className={cn(
                  "text-[10px] sm:text-xs font-medium px-2 py-1 rounded-full",
                  insightSource === 'cache' ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                )}>
                  {insightSource === 'cache' ? "오늘 분석 결과" : "새 분석 생성됨"}
                </span>
              )}
              <span className="text-[10px] sm:text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                Real-time Analysis
              </span>
              <button 
                onClick={() => fetchGoogleInsight(keyword, true)}
                disabled={loading.google}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="새로고침"
              >
                <RefreshCw className={cn("w-4 h-4 text-gray-500", loading.google && "animate-spin")} />
              </button>
            </div>
          </div>
          <div className="p-4 sm:p-8">
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

    <footer className="bg-white border-t border-gray-200 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-sm text-gray-500 font-medium">
          &copy; 2026 Production CEW. All rights reserved.
        </p>
      </div>
    </footer>
  </div>
);
}
