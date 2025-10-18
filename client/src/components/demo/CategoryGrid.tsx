import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Category {
  name: string;
  count: number;
  color: string;
}

interface CategoryGridProps {
  categories: Category[];
  onCategoryClick?: (category: string) => void;
  selectedCategory?: string | null;
}

const colorMap: Record<string, string> = {
  blue: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800',
  green: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800',
  purple: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800',
  orange: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800',
  red: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800',
  indigo: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800',
  pink: 'bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-800',
  yellow: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-800',
  cyan: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-200 dark:hover:bg-cyan-800',
  teal: 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-800',
  violet: 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-800',
  gray: 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800',
  lime: 'bg-lime-100 dark:bg-lime-900 text-lime-700 dark:text-lime-300 hover:bg-lime-200 dark:hover:bg-lime-800',
  amber: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800',
  emerald: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800',
  rose: 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-800',
  fuchsia: 'bg-fuchsia-100 dark:bg-fuchsia-900 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-200 dark:hover:bg-fuchsia-800',
  sky: 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-800',
  slate: 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800',
  zinc: 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800',
};

export function CategoryGrid({ categories, onCategoryClick, selectedCategory }: CategoryGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {categories.map((category) => {
        const isSelected = selectedCategory === category.name;
        return (
          <Card
            key={category.name}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              isSelected && "ring-2 ring-primary shadow-md"
            )}
            onClick={() => onCategoryClick?.(category.name)}
            data-testid={`category-card-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="line-clamp-2" data-testid={`category-name-${category.name.toLowerCase().replace(/\s+/g, '-')}`}>
                  {category.name}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge
                className={cn(
                  colorMap[category.color] || colorMap.gray,
                  "font-bold text-base px-3 py-1"
                )}
                data-testid={`category-count-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {category.count} features
              </Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
