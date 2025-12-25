import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TrendChartProps {
  data: any[];
  dataKey: string;
  xAxisKey: string;
  title: string;
  color?: string;
  additionalLines?: Array<{
    dataKey: string;
    color: string;
    name?: string;
  }>;
  testId?: string;
}

export function TrendChart({ 
  data, 
  dataKey, 
  xAxisKey, 
  title, 
  color = '#8884d8',
  additionalLines = [],
  testId 
}: TrendChartProps) {
  return (
    <div className="w-full h-[300px]" data-testid={testId}>
      <h3 className="text-lg font-semibold mb-4" data-testid={`${testId}-title`}>
        {title}
      </h3>
      {data && data.length > 0 ? (
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey={xAxisKey} 
              className="text-xs"
              tickFormatter={(value) => {
                if (typeof value === 'string' && value.includes('T')) {
                  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                return value;
              }}
            />
            <YAxis className="text-xs" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
              labelFormatter={(value) => {
                if (typeof value === 'string' && value.includes('T')) {
                  return new Date(value).toLocaleString();
                }
                return value;
              }}
            />
            {additionalLines.length > 0 && <Legend />}
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={2}
              dot={false}
            />
            {additionalLines.map((line, index) => (
              <Line
                key={index}
                type="monotone"
                dataKey={line.dataKey}
                stroke={line.color}
                strokeWidth={2}
                name={line.name || line.dataKey}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-muted-foreground" data-testid={`${testId}-no-data`}>
          No data available
        </div>
      )}
    </div>
  );
}
