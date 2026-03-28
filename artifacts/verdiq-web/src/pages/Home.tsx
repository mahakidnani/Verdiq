import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, TrendingUp, AlertCircle, BarChart3, Activity } from "lucide-react";
import { useGetVerdiqScore } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn, formatMetricValue, getMetricLabel } from "@/lib/utils";

// --- Score Styling Utilities ---
function getScoreStyling(score: number) {
  if (score <= 300) return { label: "Weak", color: "text-rose-600", bg: "bg-rose-50", bar: "bg-rose-500", border: "border-rose-200" };
  if (score <= 500) return { label: "Below Average", color: "text-orange-600", bg: "bg-orange-50", bar: "bg-orange-500", border: "border-orange-200" };
  if (score <= 700) return { label: "Average", color: "text-amber-600", bg: "bg-amber-50", bar: "bg-amber-500", border: "border-amber-200" };
  if (score <= 850) return { label: "Strong", color: "text-emerald-600", bg: "bg-emerald-50", bar: "bg-emerald-500", border: "border-emerald-200" };
  return { label: "Excellent", color: "text-teal-600", bg: "bg-teal-50", bar: "bg-teal-500", border: "border-teal-200" };
}

function getPillarStyling(score: number) {
  if (score <= 30) return { color: "text-rose-600", bar: "bg-rose-500" };
  if (score <= 50) return { color: "text-orange-600", bar: "bg-orange-500" };
  if (score <= 70) return { color: "text-amber-600", bar: "bg-amber-500" };
  if (score <= 85) return { color: "text-emerald-600", bar: "bg-emerald-500" };
  return { color: "text-teal-600", bar: "bg-teal-500" };
}

// --- Main Page Component ---
export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [submittedTicker, setSubmittedTicker] = useState("");

  const { data, isLoading, error } = useGetVerdiqScore(
    { ticker: submittedTicker },
    { query: { enabled: !!submittedTicker, retry: false } }
  );

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = inputValue.trim().toUpperCase();
    if (trimmed) {
      setSubmittedTicker(trimmed);
    }
  };

  // Generate Verdict Paragraph
  const generateVerdict = () => {
    if (!data) return null;
    const style = getScoreStyling(data.verdiq_score);
    const pillars = Object.values(data.pillars);
    const strongest = pillars.reduce((prev, current) => (prev.score > current.score) ? prev : current);
    
    return (
      <p className="text-muted-foreground leading-relaxed">
        With an overall score of <strong className={cn("font-semibold", style.color)}>{data.verdiq_score}</strong>, 
        <strong className="text-foreground"> {data.ticker}</strong> is rated as <strong className={cn("font-semibold", style.color)}>{style.label.toLowerCase()}</strong>. 
        Its strongest area is <strong className="text-foreground">{strongest.label}</strong> ({strongest.score}/100), 
        while it struggles most with <strong className="text-foreground">{data.weakest_pillar.label}</strong> ({data.weakest_pillar.score}/100).
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col relative overflow-hidden">
      {/* Decorative abstract background blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] rounded-full bg-blue-100/40 blur-3xl" />
        <div className="absolute top-[20%] left-[-10%] w-[30rem] h-[30rem] rounded-full bg-teal-50/40 blur-3xl" />
      </div>

      {/* Header / Hero Transition */}
      <motion.div 
        layout
        className={cn(
          "w-full px-6 flex flex-col items-center",
          submittedTicker ? "pt-8 pb-4" : "pt-[25vh]"
        )}
      >
        <motion.div layout className="w-full max-w-4xl flex flex-col md:flex-row gap-6 items-center justify-between">
          <motion.div layout className={cn("flex flex-col items-center md:items-start", submittedTicker ? "" : "w-full items-center text-center")}>
            <motion.div layoutId="logo" className="flex items-center gap-2 text-primary">
              <Activity className="w-8 h-8 md:w-10 md:h-10" />
              <h1 className="text-3xl md:text-4xl font-extrabold font-display tracking-tight">Verdiq</h1>
            </motion.div>
            {!submittedTicker && (
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-4 text-lg text-muted-foreground max-w-lg"
              >
                Intelligent stock research, simplified. Enter a ticker to get a comprehensive 5-pillar analysis instantly.
              </motion.p>
            )}
          </motion.div>

          <motion.div layout className={cn("w-full", submittedTicker ? "max-w-md" : "max-w-xl mt-8")}>
            <form onSubmit={handleSearch} className="relative flex items-center shadow-lg shadow-primary/5 rounded-2xl">
              <Search className="absolute left-4 w-5 h-5 text-muted-foreground" />
              <Input 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter stock ticker (e.g., AAPL, INFY.NS)..."
                className={cn(
                  "pl-12 pr-32 bg-white/80 backdrop-blur-md border-border/50",
                  submittedTicker ? "h-14 text-base" : "h-16 text-lg"
                )}
              />
              <div className="absolute right-2">
                <Button type="submit" size={submittedTicker ? "default" : "lg"} className="h-10 md:h-12 rounded-xl">
                  Analyse
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center pb-32"
          >
            <div className="relative">
              <Spinner className="w-12 h-12 text-primary" />
              <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-primary/20" />
            </div>
            <p className="mt-6 text-muted-foreground font-medium animate-pulse">Analysing financial data...</p>
          </motion.div>
        )}

        {error && !isLoading && (
          <motion.div 
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-4xl mx-auto px-6 py-12"
          >
            <Card className="border-rose-200 bg-rose-50/50 p-8 flex flex-col items-center text-center">
              <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
              <h3 className="text-xl font-bold text-rose-900 mb-2">Analysis Failed</h3>
              <p className="text-rose-700">
                {(error as any)?.detail || "We couldn't fetch data for this ticker. It may be invalid or unsupported."}
              </p>
            </Card>
          </motion.div>
        )}

        {data && !isLoading && !error && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, staggerChildren: 0.1 }}
            className="w-full max-w-4xl mx-auto px-6 pb-24 space-y-6"
          >
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Left Column: Overall Score & Verdict */}
              <Card className="md:col-span-5 p-8 flex flex-col items-center text-center justify-center overflow-hidden relative shadow-lg shadow-black/5">
                {/* Decorative background for the score card */}
                <div className={cn("absolute inset-0 opacity-[0.03] pointer-events-none transition-colors duration-500", getScoreStyling(data.verdiq_score).bar)} />
                
                <p className="text-sm font-semibold tracking-wider uppercase text-muted-foreground mb-6">Verdiq Score</p>
                
                <div className="relative">
                  <svg className="w-48 h-48 transform -rotate-90">
                    <circle cx="96" cy="96" r="88" className="stroke-muted/30" strokeWidth="12" fill="none" />
                    <motion.circle 
                      cx="96" cy="96" r="88" 
                      className={cn("transition-all duration-1000 ease-out", getScoreStyling(data.verdiq_score).color.replace('text-', 'stroke-'))}
                      strokeWidth="12" 
                      fill="none" 
                      strokeDasharray="553"
                      initial={{ strokeDashoffset: 553 }}
                      animate={{ strokeDashoffset: 553 - (553 * (data.verdiq_score / 1000)) }}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-extrabold font-display text-foreground tracking-tighter">
                      {data.verdiq_score}
                    </span>
                    <span className="text-sm text-muted-foreground mt-1">/ 1000</span>
                  </div>
                </div>

                <div className={cn("mt-6 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase border", getScoreStyling(data.verdiq_score).bg, getScoreStyling(data.verdiq_score).color, getScoreStyling(data.verdiq_score).border)}>
                  {getScoreStyling(data.verdiq_score).label}
                </div>

                <div className="mt-8 text-left bg-slate-50 rounded-2xl p-5 border border-slate-100">
                  {generateVerdict()}
                </div>
              </Card>

              {/* Right Column: Pillar Breakdown */}
              <Card className="md:col-span-7 p-8 shadow-md shadow-black/5">
                <div className="flex items-center gap-2 mb-8">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h3 className="text-xl font-bold font-display">Pillar Analysis</h3>
                </div>
                
                <div className="space-y-6">
                  {Object.entries(data.pillars).map(([key, pillar], index) => {
                    const styling = getPillarStyling(pillar.score);
                    const isWeakest = data.weakest_pillar.key === key;
                    
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground text-sm">{pillar.label}</span>
                            {isWeakest && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-bold uppercase tracking-wider">
                                Weakest Link
                              </span>
                            )}
                          </div>
                          <span className="font-bold font-display text-lg">{pillar.score}<span className="text-xs text-muted-foreground font-sans ml-1">/100</span></span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${pillar.score}%` }}
                            transition={{ duration: 0.8, delay: 0.1 + (index * 0.1), ease: "easeOut" }}
                            className={cn("h-full rounded-full", styling.bar)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Bottom Row: Raw Metrics Grid */}
            <Card className="p-8 shadow-md shadow-black/5">
              <div className="flex items-center gap-2 mb-8">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="text-xl font-bold font-display">Raw Financial Metrics</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {Object.entries(data.raw_metrics).map(([key, value]) => (
                  <div key={key} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all duration-300">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      {getMetricLabel(key)}
                    </p>
                    <p className="text-2xl font-bold font-display text-foreground">
                      {formatMetricValue(key, value)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
