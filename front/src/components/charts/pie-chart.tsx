"use client";
import React, { useMemo, useCallback } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Pie, PieChart, ResponsiveContainer, Cell } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";

// Define the type for the data items
export type PieChartDataItem = {
  name: string;
  value: number;
  fill?: string;
  [key: string]: string | number | undefined; // Support for dynamic properties
};

// Define props for our component
export type ResponsivePieChartProps = {
  title?: string;
  description?: string;
  data: PieChartDataItem[];
  dataKey?: string;
  nameKey?: string;
  showLegend?: boolean;
  trendValue?: number;
  trendPeriod?: string;
  footerText?: string;
  height?: number | string;
  width?: number | string;
  colors?: string[];
  className?: string;
  valueFormatter?: (value: number) => string;
};

// Default colors for the chart - vibrant colors that stand out
const defaultColors = [
  "hsl(215, 70%, 60%)", // Blue
  "hsl(160, 60%, 50%)", // Green
  "hsl(340, 80%, 65%)", // Pink
  "hsl(40, 90%, 60%)", // Orange
  "hsl(270, 60%, 70%)", // Purple
  "hsl(190, 90%, 50%)", // Cyan
  "hsl(15, 80%, 55%)", // Red-Orange
  "hsl(120, 60%, 50%)", // Lime Green
];

/**
 * 
 Example usage component that demonstrates how to use the ResponsivePieChart
export default function PieChartExample() {
  // Enhanced sample data with predefined colors
  const sampleData = [
    { name: "Chrome", value: 275, fill: "hsl(215, 70%, 60%)" },    // Blue
    { name: "Safari", value: 200, fill: "hsl(160, 60%, 50%)" },    // Green
    { name: "Firefox", value: 187, fill: "hsl(340, 80%, 65%)" },   // Pink
    { name: "Edge", value: 173, fill: "hsl(40, 90%, 60%)" },       // Orange
    { name: "Other", value: 90, fill: "hsl(270, 60%, 70%)" },      // Purple
  ];
  
  // Total for percentage calculations
  const total = sampleData.reduce((sum, item) => sum + item.value, 0);
  
  // Custom formatters for different chart instances
  const percentFormatter = (value: number) => `${(value / total * 100).toFixed(1)}%`;
  const userFormatter = (value: number) => `${value.toLocaleString()} users`;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
       Basic usage  : 
      <ResponsivePieChart
        title="Browser Usage"
        description="January - June 2024"
        data={sampleData}
        trendValue={5.2}
        footerText="Showing total visitors for the last 6 months"
        valueFormatter={userFormatter}
      />
      
      With legend: 
      <ResponsivePieChart
        title="Browser Market Share"
        description="With Legend"
        data={sampleData}
        showLegend={true}
        trendValue={-2.7}
        trendPeriod="quarter"
        valueFormatter={percentFormatter}
      />
      
      Custom height  :
      <ResponsivePieChart
        title="Custom Height Chart"
        description="400px tall"
        data={sampleData}
        height={400}
        valueFormatter={userFormatter}
      />
    </div>
  );
}
*/
const PieChartComponent = React.memo(function ResponsivePieChart({
  title = "Pie Chart",
  description,
  data = [],
  dataKey = "value",
  nameKey = "name",
  showLegend = false,
  trendValue,
  trendPeriod = "month",
  footerText,
  height = 300,
  width = "100%",
  colors = defaultColors,
  className = "",
  valueFormatter = (value: number) => value.toString(),
}: ResponsivePieChartProps) {
  // Memoize the chart config to prevent recalculations
  const chartConfig: ChartConfig = useMemo(() => {
    // Create chart config from data
    return data.reduce(
      (config, item, index) => {
        config[item.name] = {
          label: item.name,
          // Use the explicit fill color from the item, or fall back to the colors array
          color: item.fill || colors[index % colors.length],
        };
        return config;
      },
      { [dataKey]: { label: dataKey } } as ChartConfig,
    );
  }, [data, dataKey, colors]);

  // Memoize the formatter function to prevent recreation on each render
  const formatValue = useCallback(
    (value: number) => {
      return valueFormatter(value);
    },
    [valueFormatter],
  );

  // Check if data is empty
  if (data.length === 0) {
    return (
      <Card className={`flex flex-col ${className}`}>
        <CardHeader className="items-center">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40">
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  // Determine if trend is positive or negative
  const isTrendPositive =
    trendValue !== undefined ? trendValue >= 0 : undefined;

  // Calculate total for percentage calculations (if needed)
  const total = data.reduce((sum, item) => sum + item.value, 0);

  // Custom label renderer function
  const renderCustomizedLabel = (entry: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, index, value } = entry;
    // Calculate the position for the label
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180);
    const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180);

    // Only show label if the slice is big enough
    const percent = (value / total) * 100;
    if (percent < 5) return null;

    // Get the item data safely
    const item = data[index];
    const itemName =
      nameKey === "name"
        ? item.name
        : String(item[nameKey as keyof PieChartDataItem] || "");

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {itemName}
      </text>
    );
  };

  return (
    <Card className={`flex flex-col ${className}`}>
      <CardHeader className="items-center pb-0">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width={width} height="100%">
            <ChartContainer
              config={chartConfig}
              className="mx-auto pb-0 [&_.recharts-pie-label-text]:fill-foreground"
            >
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        // Safely handle value as a number
                        const numValue = typeof value === "number" ? value : 0;
                        return (
                          <div className="flex justify-between w-full">
                            <span>{name}</span>
                            <span className="ml-2 font-medium">
                              {formatValue(numValue)} (
                              {((numValue / total) * 100).toFixed(1)}%)
                            </span>
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius="80%"
                  dataKey={dataKey}
                  nameKey={nameKey}
                  animationDuration={750}
                  animationBegin={0}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.fill || colors[index % colors.length]}
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                {showLegend && (
                  <ChartLegend
                    content={<ChartLegendContent />}
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                  />
                )}
              </PieChart>
            </ChartContainer>
          </ResponsiveContainer>
        </div>
      </CardContent>
      {(trendValue !== undefined || footerText) && (
        <CardFooter className="flex-col gap-2 text-sm pt-4">
          {trendValue !== undefined && (
            <div className="flex items-center gap-2 font-medium leading-none">
              Trending {isTrendPositive ? "up" : "down"} by{" "}
              {Math.abs(trendValue).toFixed(1)}% this {trendPeriod}
              {isTrendPositive ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
          )}
          {footerText && (
            <div className="leading-none text-muted-foreground">
              {footerText}
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  );
});

export default PieChartComponent;
