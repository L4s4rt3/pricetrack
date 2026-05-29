import { Boxes, Clock, Truck } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Logistica() {
  return (
    <div className="page-shell">
      <PageHeader title="Logistica" subtitle="Area preparada para expediciones, transporte y control operativo" />
      <section className="metric-strip">
        <KPICard label="Modulo" value="Preparado" hint="Siguiente fase" icon={Truck} />
        <KPICard label="Expediciones" value="-" hint="Pendiente" icon={Boxes} />
        <KPICard label="Seguimiento" value="-" hint="Pendiente" icon={Clock} />
      </section>
      <Card className="glass-accented">
        <CardHeader>
          <CardTitle className="text-lg">Base logistica</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="max-w-3xl text-sm text-muted-foreground">Pendiente de desarrollo.</p>
        </CardContent>
      </Card>
    </div>
  );
}
