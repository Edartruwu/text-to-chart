// Chart data interfaces
export interface PieChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}

export interface WaterfallChartData {
  categories: string[];
  values: number[];
  increaseLabelText?: string;
  decreaseLabelText?: string;
  totalLabelText?: string;
}

// Chart type interfaces
export interface PieChartStatistics {
  type: "pie_chart";
  data: PieChartData;
}

export interface WaterfallChartStatistics {
  type: "waterfall_chart";
  data: WaterfallChartData;
}

export type Statistics = PieChartStatistics | WaterfallChartStatistics;

export interface StatisticsResponse {
  interpretation: string;
  statistics: Statistics;
}

export interface ChatMessage {
  role: "user" | "system";
  content: string;
  timestamp: number;
  statistics?: Statistics;
}

export interface ApiResponse<T> {
  success: boolean;
  result?: T;
  error?: string;
  sessionId?: string;
}

export interface SessionResponse {
  success: boolean;
  session: {
    id: string;
    createdAt: number;
  };
  error?: string;
}

// Chart component data types
export type PieChartDataItem = {
  name: string;
  value: number;
  fill?: string;
};

export type WaterfallChartDataPoint = {
  name: string;
  value: number;
  fill?: string;
  isTotal?: boolean;
};

// Utility functions to transform API data to chart component format
export const transformPieChartData = (
  data: PieChartData,
): PieChartDataItem[] => {
  return data.labels.map((label, index) => ({
    name: label,
    value: data.values[index],
    fill: data.colors?.[index],
  }));
};

export const transformWaterfallChartData = (
  data: WaterfallChartData,
): WaterfallChartDataPoint[] => {
  return data.categories.map((category, index) => {
    // First and last items are typically totals in a waterfall chart
    const isTotal = index === 0 || index === data.categories.length - 1;

    return {
      name: category,
      value: data.values[index],
      isTotal,
    };
  });
};
