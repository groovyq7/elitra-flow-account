import { CandlestickData, Time } from 'lightweight-charts';  
import { TimeConverter } from '@/utils/timeUtils';  
import { CandlestickDataItem, TimePeriod } from '@/types';

export class CandlestickService {  
  private static generateCandlestickData(  
    startPrice: number,   
    count: number,   
    timeInterval: (index: number) => string  
  ): CandlestickDataItem[] {  
    const data: CandlestickDataItem[] = [];  
    let currentPrice = startPrice;  

    for (let i = 0; i < count; i++) {  
      const volatility = Math.random() * 0.1;
      const isUpCandle = Math.random() > 0.5;  

      const open = currentPrice;  
      const close = isUpCandle   
        ? open * (1 + volatility)   
        : open * (1 - volatility);  
      
      const high = Math.max(open, close) * (1 + Math.random() * 0.05);  
      const low = Math.min(open, close) * (1 - Math.random() * 0.05);  

      data.push({  
        time: timeInterval(i),  
        open: Number(open.toFixed(2)),  
        high: Number(high.toFixed(2)),  
        low: Number(low.toFixed(2)),  
        close: Number(close.toFixed(2))  
      });  

      currentPrice = close;  
    }  

    return data;  
  }  

  static fetchChartData(period: TimePeriod): CandlestickData<Time>[] {  
    const periodData: Record<TimePeriod, CandlestickDataItem[]> = {  
      "1m": this.generateCandlestickData(100, 12*30*24*60, (i) => {  
        const date = new Date(2023, 0, 1);  
        date.setMinutes(date.getMinutes() + i);  
        return date.toISOString();  
      }),  
      
      "5m": this.generateCandlestickData(100, 12*30*24*12, (i) => {  
        const date = new Date(2023, 0, 1);  
        date.setMinutes(date.getMinutes() + i * 5);  
        return date.toISOString();  
      }), 
      
      "15m": this.generateCandlestickData(100, 12*30*24*4, (i) => {  
        const date = new Date(2023, 0, 1);  
        date.setMinutes(date.getMinutes() + i * 15);  
        return date.toISOString();  
      }), 
      
      "30m": this.generateCandlestickData(100, 12*30*24*2, (i) => {  
        const date = new Date(2023, 0, 1);  
        date.setMinutes(date.getMinutes() + i * 30);  
        return date.toISOString();  
      }), 
      
      "1H": this.generateCandlestickData(100, 12*30*24, (i) => {  
        const date = new Date(2023, 0, 1);  
        date.setHours(date.getHours() + i);  
        return date.toISOString();  
      }), 
      
      "2H": this.generateCandlestickData(100, 12*30*12, (i) => {  
        const date = new Date(2023, 0, 1);  
        date.setHours(date.getHours() + i * 2);  
        return date.toISOString();  
      }), 

      "6H": this.generateCandlestickData(100, 12*30*4, (i) => {  
        const date = new Date(2023, 0, 1);  
        date.setHours(date.getHours() + i * 6);  
        return date.toISOString();  
      }), 

      "12H": this.generateCandlestickData(100, 12*30*2, (i) => {  
        const date = new Date(2023, 0, 1);  
        date.setHours(date.getHours() + i * 12);  
        return date.toISOString();  
      }), 
      
      "1D": this.generateCandlestickData(100, 12 * 30, (i) => {  
        const date = new Date(2023, 0, 1);  
        date.setDate(date.getDate() + i);  
        return date.toISOString().split('T')[0];  
      }),  

      "1W": this.generateCandlestickData(100, 12 * 4, (i) => {  
        const date = new Date(2023, 0, 1);  
        date.setDate(date.getDate() + i * 7);  
        return date.toISOString().split('T')[0];  
      }),  
      
      "1M": this.generateCandlestickData(100, 12, (i) => {  
        const date = new Date(2023, i, 1);  
        return date.toISOString().split('T')[0];  
      }),  
      
    };  

    return periodData[period].map(item => ({  
      time: TimeConverter.safeConvert(item.time),  
      open: item.open,  
      high: item.high,  
      low: item.low,  
      close: item.close,  
    }));  
  }  

  static async fetchDataFromAPI(period: TimePeriod): Promise<CandlestickData<Time>[]> {  
    try {  
      const response = await fetch(`/api/candlestick-data?period=${period}`);  
      const data: CandlestickDataItem[] = await response.json();  
      
      return data.map(item => ({  
        time: TimeConverter.safeConvert(item.time),  
        open: item.open,  
        high: item.high,  
        low: item.low,  
        close: item.close,  
      }));  
    } catch (error) {  
      console.error('Failed to fetch data:', error);  
      return this.fetchChartData(period); 
    }  
  }  
}