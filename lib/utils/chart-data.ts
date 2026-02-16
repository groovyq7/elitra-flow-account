// Generate chart data with a more pronounced upward curve (accelerating growth)
export function generateCurvedChartData(
  startDate: string,
  points: number,
  initialBalance: number,
  apy: number, // Annual percentage yield
  timeframe: 'weekly' | 'monthly' = 'weekly'
) {
  const data = [];
  let date = new Date(startDate);
  let balance = initialBalance;
  const periodsPerYear = timeframe === 'weekly' ? 52 : 12;
  let growthRate = apy / 100 / periodsPerYear;
  const growthAcceleration = growthRate * 0.04; // 8% more growth per period

  for (let i = 0; i < points; i++) {
    data.push({
      date: date.toISOString().slice(0, 10),
      value: Math.round(balance * 100) / 100,
    });

    // Move to next period
    if (timeframe === 'weekly') {
      date.setDate(date.getDate() + 7);
    } else {
      date.setMonth(date.getMonth() + 1);
    }

    // Compound the balance with an increasing growth rate
    balance = balance * (1 + growthRate);
    growthRate += growthAcceleration; // Accelerate growth
  }

  return data;
}
// Generate realistic chart data based on actual portfolio data
export function generateRealisticChartData(
  startDate: string,
  points: number,
  initialBalance: number,
  apy: number, // Annual percentage yield
  timeframe: 'weekly' | 'monthly' = 'weekly'
) {
  const data = [];
  let date = new Date(startDate);
  let balance = initialBalance;
  
  // Calculate growth per period
  const periodsPerYear = timeframe === 'weekly' ? 52 : 12;
  const growthRate = apy / 100 / periodsPerYear;
  
  for (let i = 0; i < points; i++) {
    data.push({
      date: date.toISOString().slice(0, 10),
      value: Math.round(balance * 100) / 100,
    });
    
    // Move to next period
    if (timeframe === 'weekly') {
      date.setDate(date.getDate() + 7);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    
    // Compound the balance
    balance = balance * (1 + growthRate);
  }
  
  return data;
}

// Generate comparison data (what you would have with just holding)
export function generateHoldingComparisonData(
  chartData: Array<{date: string, value: number}>,
  initialBalance: number
) {
  return chartData.map(item => ({
    date: item.date,
    value: initialBalance, // Holding stays flat (no growth)
  }));
}