import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useTenant } from "@/contexts/TenantContext";

interface ExportButtonProps {
  data: any[];
  filename: string;
  columns: { header: string; key: string; format?: (value: any) => string }[];
  title?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
}

export function ExportButton({ 
  data, 
  filename, 
  columns, 
  title,
  size = "default",
  variant = "outline"
}: ExportButtonProps) {
  const { stateConfig, branding } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  const stateCode = stateConfig?.stateCode || 'STATE';
  // Use tenant primary color or default to neutral
  const primaryColor = branding?.primaryColor || 'rgb(59, 130, 246)'; // Default blue
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = () => {
    setIsExporting(true);
    try {
      // Transform data to match columns
      const csvData = data.map(row => {
        const csvRow: any = {};
        columns.forEach(col => {
          const value = row[col.key];
          csvRow[col.header] = col.format ? col.format(value) : value;
        });
        return csvRow;
      });

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      // console.error("CSV export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      
      // Add state branding
      doc.setFontSize(20);
      // Use tenant primary color or default
      const rgb = primaryColor.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        doc.setTextColor(parseInt(rgb[0]), parseInt(rgb[1]), parseInt(rgb[2]));
      }
      doc.text(`${stateName} SNAP`, 14, 22);
      
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(title || "Data Export", 14, 32);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);

      // Transform data for PDF table
      const tableData = data.map(row => 
        columns.map(col => {
          const value = row[col.key];
          return col.format ? col.format(value) : String(value || "—");
        })
      );

      // Add table
      autoTable(doc, {
        head: [columns.map(col => col.header)],
        body: tableData,
        startY: 45,
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: rgb && rgb.length >= 3 ? [parseInt(rgb[0]), parseInt(rgb[1]), parseInt(rgb[2])] : [59, 130, 246],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
      });

      doc.save(`${filename}.pdf`);
    } catch (error) {
      // console.error("PDF export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  if (data.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size} 
          disabled={isExporting}
          data-testid="button-export"
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Exporting..." : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={exportToCSV} data-testid="menu-export-csv">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF} data-testid="menu-export-pdf">
          <FileText className="mr-2 h-4 w-4" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
