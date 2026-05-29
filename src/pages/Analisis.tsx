import { NavLink } from "react-router-dom";
import { GitCompareArrows, LineChart, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const analysisTools = [
  { to: "/tendencias", label: "Tendencias", icon: TrendingUp },
  { to: "/comparar", label: "Comparativas", icon: GitCompareArrows },
  { to: "/predicciones", label: "Predicciones", icon: LineChart },
];

export default function Analisis() {
  return (
    <div className="page-shell">
      <PageHeader title="Analisis" subtitle="Tendencias, comparativas y predicciones para decidir rapido" />
      <div className="grid gap-4 lg:grid-cols-3">
        {analysisTools.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.to} className="glass-accented commercial-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Icon className="h-4 w-4 text-primary" />{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full justify-between">
                  <NavLink to={item.to}>Abrir {item.label}<span aria-hidden="true">→</span></NavLink>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
