import os
import math
from typing import Optional
from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import JSONResponse
import yfinance as yf
import pandas as pd
import numpy as np
import anthropic

app = FastAPI(title="Verdiq API", description="Stock research scoring API")

_anthropic_client = None

def get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        integration_url = os.environ.get("AI_INTEGRATIONS_ANTHROPIC_BASE_URL")
        integration_key = os.environ.get("AI_INTEGRATIONS_ANTHROPIC_API_KEY")
        if integration_url and integration_key:
            _anthropic_client = anthropic.Anthropic(
                api_key=integration_key,
                base_url=integration_url,
            )
        else:
            api_key = os.environ.get("ANTHROPIC_API_KEY")
            if not api_key:
                raise RuntimeError("No Anthropic credentials found. Set AI_INTEGRATIONS_ANTHROPIC_BASE_URL / AI_INTEGRATIONS_ANTHROPIC_API_KEY or ANTHROPIC_API_KEY.")
            _anthropic_client = anthropic.Anthropic(api_key=api_key)
    return _anthropic_client


def safe_get(value, default=None):
    if value is None:
        return default
    if isinstance(value, float) and math.isnan(value):
        return default
    return value


def clamp(value: float, min_val: float = 0.0, max_val: float = 100.0) -> float:
    return max(min_val, min(max_val, value))


def score_roe(roe: Optional[float]) -> float:
    if roe is None:
        return 40.0
    pct = roe * 100
    if pct >= 20:
        return 100.0
    elif pct >= 15:
        return 80.0
    elif pct >= 10:
        return 60.0
    elif pct >= 5:
        return 40.0
    elif pct >= 0:
        return 20.0
    else:
        return 0.0


def score_revenue_growth(growth_rate: Optional[float]) -> float:
    if growth_rate is None:
        return 40.0
    pct = growth_rate * 100
    if pct >= 20:
        return 100.0
    elif pct >= 10:
        return 80.0
    elif pct >= 5:
        return 60.0
    elif pct >= 0:
        return 40.0
    elif pct >= -5:
        return 20.0
    else:
        return 0.0


def score_profit_margin(margin: Optional[float]) -> float:
    if margin is None:
        return 40.0
    pct = margin * 100
    if pct >= 20:
        return 100.0
    elif pct >= 10:
        return 80.0
    elif pct >= 5:
        return 60.0
    elif pct >= 0:
        return 30.0
    else:
        return 0.0


def score_de_ratio(de: Optional[float]) -> float:
    if de is None:
        return 50.0
    if de < 0:
        return 30.0
    elif de <= 0.5:
        return 100.0
    elif de <= 1.0:
        return 80.0
    elif de <= 1.5:
        return 60.0
    elif de <= 2.5:
        return 40.0
    elif de <= 4.0:
        return 20.0
    else:
        return 0.0


def score_pe_ratio(pe: Optional[float]) -> float:
    if pe is None:
        return 40.0
    if pe <= 0:
        return 10.0
    elif pe <= 10:
        return 100.0
    elif pe <= 15:
        return 90.0
    elif pe <= 20:
        return 75.0
    elif pe <= 25:
        return 60.0
    elif pe <= 35:
        return 45.0
    elif pe <= 50:
        return 30.0
    else:
        return 10.0


def score_fcf(fcf: Optional[float]) -> float:
    if fcf is None:
        return 40.0
    if fcf > 1e9:
        return 100.0
    elif fcf > 5e8:
        return 85.0
    elif fcf > 1e8:
        return 70.0
    elif fcf > 0:
        return 55.0
    elif fcf > -1e8:
        return 30.0
    else:
        return 10.0


def fetch_financial_data(ticker: str) -> dict:
    stock = yf.Ticker(ticker)
    info = stock.info

    roe = safe_get(info.get("returnOnEquity"))
    pe_ratio = safe_get(info.get("trailingPE"))
    profit_margin = safe_get(info.get("profitMargins"))
    total_debt = safe_get(info.get("totalDebt"), 0)
    total_equity = safe_get(info.get("totalStockholderEquity")) or safe_get(info.get("stockholdersEquity"))
    free_cashflow = safe_get(info.get("freeCashflow"))

    de_ratio = None
    if total_equity and total_equity != 0:
        de_ratio = total_debt / total_equity

    revenue_growth = None
    try:
        financials = stock.financials
        if financials is not None and not financials.empty:
            if "Total Revenue" in financials.index:
                revenues = financials.loc["Total Revenue"].dropna()
                if len(revenues) >= 2:
                    revenues_sorted = revenues.sort_index()
                    oldest = revenues_sorted.iloc[0]
                    newest = revenues_sorted.iloc[-1]
                    if oldest > 0:
                        years = len(revenues_sorted) - 1
                        if years > 0:
                            revenue_growth = (newest / oldest) ** (1 / years) - 1
    except Exception:
        revenue_growth = None

    return {
        "roe": roe,
        "pe_ratio": pe_ratio,
        "profit_margin": profit_margin,
        "de_ratio": de_ratio,
        "free_cashflow": free_cashflow,
        "revenue_growth": revenue_growth,
        "info": info,
    }


def calculate_verdiq_score(data: dict) -> dict:
    roe = data["roe"]
    pe_ratio = data["pe_ratio"]
    profit_margin = data["profit_margin"]
    de_ratio = data["de_ratio"]
    free_cashflow = data["free_cashflow"]
    revenue_growth = data["revenue_growth"]

    financial_health_score = clamp(
        (score_roe(roe) * 0.5) + (score_revenue_growth(revenue_growth) * 0.5)
    )

    profitability_score = clamp(
        (score_profit_margin(profit_margin) * 0.6) + (score_roe(roe) * 0.4)
    )

    valuation_fairness_score = clamp(score_pe_ratio(pe_ratio))

    earnings_quality_score = clamp(
        (score_fcf(free_cashflow) * 0.6) + (score_profit_margin(profit_margin) * 0.4)
    )

    debt_safety_score = clamp(score_de_ratio(de_ratio))

    pillars = {
        "financial_health": {
            "score": round(financial_health_score, 2),
            "weight": 0.25,
            "label": "Financial Health",
        },
        "profitability": {
            "score": round(profitability_score, 2),
            "weight": 0.20,
            "label": "Profitability",
        },
        "valuation_fairness": {
            "score": round(valuation_fairness_score, 2),
            "weight": 0.20,
            "label": "Valuation Fairness",
        },
        "earnings_quality": {
            "score": round(earnings_quality_score, 2),
            "weight": 0.20,
            "label": "Earnings Quality",
        },
        "debt_safety": {
            "score": round(debt_safety_score, 2),
            "weight": 0.15,
            "label": "Debt Safety",
        },
    }

    weighted_sum = sum(p["score"] * p["weight"] for p in pillars.values())
    verdiq_score = round(weighted_sum * 10)

    weakest_pillar = min(pillars.items(), key=lambda x: x[1]["score"])

    return {
        "verdiq_score": verdiq_score,
        "pillars": {
            key: {
                "score": val["score"],
                "weight_pct": int(val["weight"] * 100),
                "label": val["label"],
            }
            for key, val in pillars.items()
        },
        "weakest_pillar": {
            "key": weakest_pillar[0],
            "label": weakest_pillar[1]["label"],
            "score": weakest_pillar[1]["score"],
        },
        "raw_metrics": {
            "roe": round(data["roe"] * 100, 2) if data["roe"] is not None else None,
            "revenue_growth_cagr_pct": round(data["revenue_growth"] * 100, 2) if data["revenue_growth"] is not None else None,
            "profit_margin_pct": round(data["profit_margin"] * 100, 2) if data["profit_margin"] is not None else None,
            "de_ratio": round(data["de_ratio"], 4) if data["de_ratio"] is not None else None,
            "pe_ratio": round(data["pe_ratio"], 2) if data["pe_ratio"] is not None else None,
            "free_cashflow": data["free_cashflow"],
        },
    }


def build_breakdown_prompt(ticker: str, info: dict) -> str:
    company_name = info.get("longName") or info.get("shortName") or ticker
    sector = info.get("sector", "unknown sector")
    industry = info.get("industry", "unknown industry")
    description = info.get("longBusinessSummary", "")
    country = info.get("country", "")
    market_cap = info.get("marketCap")
    revenue = info.get("totalRevenue")

    context_parts = [f"Company: {company_name} (ticker: {ticker})"]
    if sector and sector != "unknown sector":
        context_parts.append(f"Sector: {sector}")
    if industry and industry != "unknown industry":
        context_parts.append(f"Industry: {industry}")
    if country:
        context_parts.append(f"Country: {country}")
    if market_cap:
        context_parts.append(f"Market cap: ${market_cap:,.0f}")
    if revenue:
        context_parts.append(f"Annual revenue: ${revenue:,.0f}")
    if description:
        context_parts.append(f"\nOfficial description: {description[:800]}")

    context = "\n".join(context_parts)

    return f"""You are a friendly financial educator helping beginner investors understand companies.

Here is information about a company:
{context}

Write exactly 3 sentences in plain English (no jargon) that explain:
1. What this company does and what products or services it sells
2. How it makes money (its main revenue sources)
3. One key risk a beginner investor should be aware of

Rules:
- Use simple language a 16-year-old could understand
- Be specific to this company, not generic
- Do not use bullet points or numbering — write as flowing prose
- Do not start with "This company" — start directly with the company name or something more engaging
- Keep each sentence concise and informative"""


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/score")
def get_score(ticker: str = Query(..., description="Stock ticker symbol e.g. TATAMOTORS.NS")):
    ticker = ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker symbol cannot be empty")

    try:
        data = fetch_financial_data(ticker)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch data for ticker '{ticker}': {str(e)}")

    try:
        result = calculate_verdiq_score(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Score calculation failed: {str(e)}")

    return {
        "ticker": ticker,
        **result,
    }


@app.get("/breakdown")
def get_breakdown(ticker: str = Query(..., description="Stock ticker symbol e.g. INFY.NS")):
    ticker = ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker symbol cannot be empty")

    try:
        stock = yf.Ticker(ticker)
        info = stock.info
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch data for ticker '{ticker}': {str(e)}")

    company_name = info.get("longName") or info.get("shortName") or ticker

    if len(info) <= 1:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for ticker '{ticker}'. It may be invalid or unavailable."
        )

    try:
        prompt = build_breakdown_prompt(ticker, info)
        client = get_anthropic_client()
        message = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        explanation = message.content[0].text.strip()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate breakdown: {str(e)}")

    return {
        "ticker": ticker,
        "company_name": company_name,
        "explanation": explanation,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
