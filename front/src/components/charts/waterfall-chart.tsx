"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegendContent,
  type ChartConfig,
} from "../ui/chart"; // Adjust import path as needed

// Types for WaterfallChart
export interface WaterfallChartDataPoint {
  name: string;
  value: number;
  // Optional fields
  fill?: string;
  isTotal?: boolean;
}

export interface WaterfallChartProps {
  data: WaterfallChartDataPoint[];
  className?: string;
  height?: number | string;
  margin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  xAxisProps?: Omit<RechartsPrimitive.XAxisProps, "dataKey">;
  yAxisProps?: Omit<RechartsPrimitive.YAxisProps, "dataKey">;
  tooltipProps?: Partial<RechartsPrimitive.TooltipProps<number, string>>;
  legendProps?: Omit<RechartsPrimitive.LegendProps, "ref">;
  showLegend?: boolean;
  gridProps?: Partial<RechartsPrimitive.CartesianGridProps>;
  positiveColor?: string;
  negativeColor?: string;
  totalColor?: string;
  hideTooltip?: boolean;
  hideLegend?: boolean;
  hideGrid?: boolean;
  formatValue?: (value: number) => string;
  onClick?: (data: WaterfallChartDataPoint) => void;
}

/**
 * WaterfallChart Component
 *
 * A responsive waterfall chart that shows how an initial value is affected by intermediate values
 * to reach a final value.
 */
export function WaterfallChart({
  data,
  className,
  height = undefined,
  margin = { top: 20, right: 20, bottom: 30, left: 40 },
  xAxisProps,
  yAxisProps,
  tooltipProps,
  legendProps,
  gridProps,
  positiveColor = "var(--color-positive, #10b981)",
  negativeColor = "var(--color-negative, #ef4444)",
  totalColor = "var(--color-total, #6366f1)",
  hideTooltip = false,
  hideLegend = false,
  hideGrid = false,
  formatValue = (value) => value.toLocaleString(),
  onClick,
}: WaterfallChartProps) {
  // Process data to calculate running totals
  const processedData = React.useMemo(() => {
    let runningTotal = 0;

    return data.map((item, _index) => {
      const start = item.isTotal ? 0 : runningTotal;
      const end = item.isTotal ? item.value : runningTotal + item.value;
      const change = end - start;

      // Only update running total if not a total item
      if (!item.isTotal) {
        runningTotal = end;
      }

      return {
        ...item,
        start,
        end,
        change,
        // Determine fill color based on value and isTotal
        fillColor:
          item.fill ||
          (item.isTotal
            ? totalColor
            : change >= 0
              ? positiveColor
              : negativeColor),
      };
    });
  }, [data, positiveColor, negativeColor, totalColor]);

  // Define chart config for the component system
  const chartConfig: ChartConfig = React.useMemo(
    () => ({
      positive: {
        label: "Increase",
        color: positiveColor,
      },
      negative: {
        label: "Decrease",
        color: negativeColor,
      },
      total: {
        label: "Total",
        color: totalColor,
      },
    }),
    [positiveColor, negativeColor, totalColor],
  );

  const handleBarClick = React.useCallback(
    (entry: any) => {
      if (onClick && entry?.payload) {
        onClick(entry.payload);
      }
    },
    [onClick],
  );

  return (
    <ChartContainer className={className} config={chartConfig}>
      <RechartsPrimitive.ComposedChart
        data={processedData}
        margin={margin}
        height={typeof height === "number" ? height : undefined}
      >
        {!hideGrid && (
          <RechartsPrimitive.CartesianGrid
            strokeDasharray="3 3"
            {...gridProps}
          />
        )}

        <RechartsPrimitive.XAxis dataKey="name" scale="band" {...xAxisProps} />

        <RechartsPrimitive.YAxis {...yAxisProps} tickFormatter={formatValue} />

        {!hideTooltip && (
          <ChartTooltip
            content={(props: any) => {
              // This wrapper allows us to bypass the strict typing issues
              return (
                <ChartTooltipContent
                  {...props}
                  formatter={(_value: any, _name: any, entry: any) => {
                    const item = entry?.payload;
                    if (!item) return null;

                    const { change, isTotal } = item;

                    return (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          {isTotal
                            ? "Final Value"
                            : change >= 0
                              ? "Increase"
                              : "Decrease"}
                        </span>
                        <span className="text-foreground font-mono font-medium">
                          {formatValue(Math.abs(change))}
                        </span>
                      </div>
                    );
                  }}
                  {...tooltipProps}
                />
              );
            }}
          />
        )}

        {!hideLegend && (
          <RechartsPrimitive.Legend
            content={<ChartLegendContent />}
            {...(() => {
              if (!legendProps) return {};
              const { ...restLegendProps } = legendProps;
              return restLegendProps;
            })()}
          />
        )}

        {/* Render connecting lines between bars */}
        <RechartsPrimitive.Line
          dataKey="end"
          strokeWidth={2}
          stroke="transparent"
          activeDot={false}
          dot={false}
        />

        {/* Waterfall bars */}
        <RechartsPrimitive.Bar
          dataKey="change"
          radius={[4, 4, 0, 0]}
          onClick={handleBarClick}
        >
          {processedData.map((entry, index) => (
            <RechartsPrimitive.Cell
              key={`cell-${index}`}
              fill={entry.fillColor}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            />
          ))}
        </RechartsPrimitive.Bar>

        {/* Invisible bars for proper positioning */}
        <RechartsPrimitive.Bar
          dataKey="start"
          stackId="stack"
          fill="transparent"
          stroke="transparent"
        />

        <RechartsPrimitive.Bar
          dataKey="change"
          stackId="stack"
          radius={[4, 4, 0, 0]}
        >
          {processedData.map((entry, index) => (
            <RechartsPrimitive.Cell
              key={`visible-cell-${index}`}
              fill={entry.fillColor}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            />
          ))}
        </RechartsPrimitive.Bar>
      </RechartsPrimitive.ComposedChart>
    </ChartContainer>
  );
}

// Example usage:
/*
const data = [
  { name: "Start", value: 1000, isTotal: true },
  { name: "Product Revenue", value: 500 },
  { name: "Service Revenue", value: 300 },
  { name: "Fixed Costs", value: -400 },
  { name: "Variable Costs", value: -300 },
  { name: "End", value: 1100, isTotal: true },
];

<WaterfallChart data={data} />
*/
